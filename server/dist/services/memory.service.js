import redisClient from "../config/redis.config.js";
import sequelize from "../db/database.config.js";
import { getChatCompletion } from "./openai.service.js";
import { generateEmbedding } from "./embedding.service.js";
const LTM_CONFIG = {
    REDIS_TTL: parseInt(process.env.LTM_REDIS_TTL || "604800"),
    META_MODEL: process.env.LTM_META_MODEL || "gpt-4o-mini",
    MAX_EVENTS: parseInt(process.env.LTM_MAX_EVENTS || "100"),
    BACKGROUND_DELAY: parseInt(process.env.LTM_BACKGROUND_DELAY || "2000"),
    ENABLED: process.env.LTM_ENABLED !== "false",
};
export async function getUserProfile(userId) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return null;
        const profileJson = await redisClient.get(`user:${userId}:profile`);
        if (!profileJson) {
            return null;
        }
        const profile = JSON.parse(profileJson);
        return profile;
    }
    catch (error) {
        return null;
    }
}
export async function updateUserProfile(userId, facts) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return;
        const current = (await getUserProfile(userId)) || {
            user_id: userId,
            facts: {
                personal: {},
                preferences: {},
                technical_context: {},
            },
            updated_at: new Date().toISOString(),
            version: 0,
        };
        current.facts = {
            personal: {
                ...current.facts.personal,
                ...facts.personal,
            },
            preferences: {
                ...current.facts.preferences,
                ...facts.preferences,
                languages: mergeTags(current.facts.preferences?.languages, facts.preferences?.languages),
                topics: mergeTags(current.facts.preferences?.topics, facts.preferences?.topics),
                frameworks: mergeTags(current.facts.preferences?.frameworks, facts.preferences?.frameworks),
            },
            technical_context: {
                ...current.facts.technical_context,
                ...facts.technical_context,
                current_projects: mergeTags(current.facts.technical_context?.current_projects, facts.technical_context?.current_projects),
                frameworks: mergeTags(current.facts.technical_context?.frameworks, facts.technical_context?.frameworks),
                challenges: mergeTags(current.facts.technical_context?.challenges, facts.technical_context?.challenges),
                goals: mergeTags(current.facts.technical_context?.goals, facts.technical_context?.goals),
                recent_technologies: mergeTags(current.facts.technical_context?.recent_technologies, facts.technical_context?.recent_technologies, { maxLength: 10 }),
            },
        };
        current.updated_at = new Date().toISOString();
        current.version += 1;
        await redisClient.set(`user:${userId}:profile`, JSON.stringify(current), "EX", LTM_CONFIG.REDIS_TTL);
    }
    catch (error) {
        throw error;
    }
}
export async function clearUserProfile(userId) {
    try {
        await redisClient.del(`user:${userId}:profile`);
    }
    catch (error) {
        throw error;
    }
}
export async function createUserEvent(userId, conversationId, event) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return;
        let embeddingStr = null;
        try {
            const embeddingVector = await generateEmbedding(event.summary);
            embeddingStr = JSON.stringify(embeddingVector);
        }
        catch (err) {
        }
        await sequelize.query(`
      INSERT INTO user_memory_events (
        user_id, conversation_id, event_type, summary, 
        content, keywords, embedding, importance_score, context
      ) VALUES (
        :userId, :conversationId, :eventType, :summary,
        :content, :keywords, :embedding, :importanceScore, :context
      )
    `, {
            replacements: {
                userId,
                conversationId: conversationId || null,
                eventType: event.event_type,
                summary: event.summary,
                content: event.content || null,
                keywords: event.keywords,
                embedding: embeddingStr,
                importanceScore: event.importance_score || 5,
                context: JSON.stringify(event.context || {}),
            },
        });
    }
    catch (error) {
        throw error;
    }
}
export async function getRelevantEvents(userId, currentMessage, limit = 5) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return [];
        try {
            const embedding = await generateEmbedding(currentMessage);
            const embeddingStr = JSON.stringify(embedding);
            const [events] = await sequelize.query(`
        SELECT 
          id, user_id, conversation_id, event_type, summary, content, 
          keywords, importance_score, context, created_at, accessed_at, access_count,
          1 - (embedding <=> :embedding::vector) as similarity
        FROM user_memory_events
        WHERE user_id = :userId
          AND embedding IS NOT NULL
        ORDER BY 
          (1 - (embedding <=> :embedding::vector)) DESC,
          importance_score DESC
        LIMIT :limit
      `, {
                replacements: { userId, embedding: embeddingStr, limit },
            });
            const eventIds = events.map((e) => e.id);
            if (eventIds.length > 0) {
                await sequelize.query(`
          UPDATE user_memory_events
          SET accessed_at = NOW(), access_count = access_count + 1
          WHERE id = ANY(:eventIds)
        `, {
                    replacements: { eventIds },
                });
            }
            return events;
        }
        catch (embeddingError) {
            const keywords = extractKeywords(currentMessage);
            const [events] = await sequelize.query(`
        SELECT 
          id, user_id, conversation_id, event_type, summary, content, 
          keywords, importance_score, context, created_at, accessed_at, access_count
        FROM user_memory_events
        WHERE user_id = :userId
          AND keywords && :keywords
        ORDER BY importance_score DESC, created_at DESC
        LIMIT :limit
      `, {
                replacements: { userId, keywords, limit },
            });
            return events;
        }
    }
    catch (error) {
        return [];
    }
}
export async function getUserEvents(userId, limit = 50, offset = 0) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return { events: [], total: 0 };
        const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM user_memory_events
      WHERE user_id = :userId
    `, {
            replacements: { userId },
        });
        const total = countResult[0].total;
        const [events] = await sequelize.query(`
      SELECT 
        id, user_id, conversation_id, event_type, summary, content, 
        keywords, importance_score, context, created_at, accessed_at, access_count
      FROM user_memory_events
      WHERE user_id = :userId
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
    `, {
            replacements: { userId, limit, offset },
        });
        return { events: events, total };
    }
    catch (error) {
        return { events: [], total: 0 };
    }
}
export async function pruneUserEvents(userId) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return 0;
        const [result] = await sequelize.query(`
      DELETE FROM user_memory_events
      WHERE id IN (
        SELECT id FROM user_memory_events
        WHERE user_id = :userId
        ORDER BY created_at DESC
        OFFSET :maxEvents
      )
    `, {
            replacements: { userId, maxEvents: LTM_CONFIG.MAX_EVENTS },
        });
        const deleted = result.rowCount || 0;
        return deleted;
    }
    catch (error) {
        return 0;
    }
}
export async function updateConversationSummary(conversationId, summary) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return;
        const [conversations] = await sequelize.query(`
      SELECT user_id FROM conversations WHERE id = :conversationId
    `, {
            replacements: { conversationId },
        });
        if (!conversations || conversations.length === 0) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        const userId = conversations[0].user_id;
        const [messageCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM messages WHERE conversation_id = :conversationId
    `, {
            replacements: { conversationId },
        });
        const count = messageCount[0].count;
        await sequelize.query(`
      INSERT INTO user_conversation_summary (
        user_id, conversation_id, title, summary, 
        key_topics, technical_topics, outcome, followup_suggestions, message_count
      ) VALUES (
        :userId, :conversationId, :title, :summary,
        :keyTopics, :technicalTopics, :outcome, :followupSuggestions, :messageCount
      )
      ON CONFLICT (conversation_id) 
      DO UPDATE SET
        title = COALESCE(EXCLUDED.title, user_conversation_summary.title),
        summary = COALESCE(EXCLUDED.summary, user_conversation_summary.summary),
        key_topics = COALESCE(EXCLUDED.key_topics, user_conversation_summary.key_topics),
        technical_topics = COALESCE(EXCLUDED.technical_topics, user_conversation_summary.technical_topics),
        outcome = COALESCE(EXCLUDED.outcome, user_conversation_summary.outcome),
        followup_suggestions = COALESCE(EXCLUDED.followup_suggestions, user_conversation_summary.followup_suggestions),
        message_count = COALESCE(EXCLUDED.message_count, user_conversation_summary.message_count),
        updated_at = NOW()
    `, {
            replacements: {
                userId,
                conversationId,
                title: summary.title || null,
                summary: summary.summary || null,
                keyTopics: summary.key_topics || null,
                technicalTopics: summary.technical_topics || null,
                outcome: summary.outcome || null,
                followupSuggestions: summary.followup_suggestions || null,
                messageCount: summary.message_count || count,
            },
        });
    }
    catch (error) {
        throw error;
    }
}
export async function getRecentConversationSummaries(userId, limit = 5) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return [];
        const [summaries] = await sequelize.query(`
      SELECT 
        cs.id, cs.user_id, cs.conversation_id, cs.title, cs.summary, 
        cs.key_topics, cs.technical_topics, cs.outcome, cs.followup_suggestions,
        cs.message_count, cs.created_at, cs.updated_at,
        c.updated_at as conversation_updated_at
      FROM user_conversation_summary cs
      JOIN conversations c ON cs.conversation_id = c.id
      WHERE cs.user_id = :userId
        AND c.deleted_at IS NULL
      ORDER BY c.updated_at DESC
      LIMIT :limit
    `, {
            replacements: { userId, limit },
        });
        return summaries;
    }
    catch (error) {
        return [];
    }
}
function mergeTags(existing, newTags, options = {}) {
    const { maxLength = 50, deduplicate = true, caseSensitive = false } = options;
    if (!newTags || newTags.length === 0)
        return existing || [];
    if (!existing || existing.length === 0)
        return newTags.slice(0, maxLength);
    let combined = [...existing, ...newTags];
    if (deduplicate) {
        if (caseSensitive) {
            combined = Array.from(new Set(combined));
        }
        else {
            const seen = new Set();
            combined = combined.filter((item) => {
                const lower = item.toLowerCase();
                if (seen.has(lower))
                    return false;
                seen.add(lower);
                return true;
            });
        }
    }
    return combined.slice(0, maxLength);
}
export function extractKeywords(text) {
    if (!text)
        return [];
    const words = text
        .toLowerCase()
        .split(/\W+/)
        .filter((word) => word.length > 3);
    const stopWords = new Set([
        "this",
        "that",
        "with",
        "from",
        "have",
        "what",
        "when",
        "where",
        "which",
        "their",
        "about",
        "would",
        "there",
        "could",
        "should",
        "these",
        "those",
    ]);
    const keywords = Array.from(new Set(words.filter((word) => !stopWords.has(word)))).slice(0, 10);
    return keywords;
}
export function isLTMEnabled() {
    return LTM_CONFIG.ENABLED;
}
export function getLTMConfig() {
    return { ...LTM_CONFIG };
}
export async function extractMemoryFromConversation(params) {
    const { userMessage, assistantMessage, currentProfile } = params;
    try {
        if (!LTM_CONFIG.ENABLED) {
            return { facts: {}, events: [], conversation_summary: null };
        }
        const metaPrompt = buildMemoryExtractionPrompt(userMessage, assistantMessage, currentProfile);
        const response = await getChatCompletion({
            messages: [
                { role: "system", content: metaPrompt },
                {
                    role: "user",
                    content: `Analyze this conversation exchange:\n\nUser: ${userMessage}\n\nAssistant: ${assistantMessage}`,
                },
            ],
            model: LTM_CONFIG.META_MODEL,
            temperature: 0.3,
            max_completion_tokens: 1500,
        });
        let analysis;
        try {
            let content = response.content.trim();
            if (content.startsWith("```json")) {
                content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            }
            else if (content.startsWith("```")) {
                content = content.replace(/```\n?/g, "");
            }
            analysis = JSON.parse(content);
        }
        catch (parseError) {
            return { facts: {}, events: [], conversation_summary: null };
        }
        return analysis;
    }
    catch (error) {
        return { facts: {}, events: [], conversation_summary: null };
    }
}
function buildMemoryExtractionPrompt(_userMessage, _assistantMessage, currentProfile) {
    const existingFacts = currentProfile?.facts || {};
    return `You are a Memory Extraction AI. Analyze conversations and extract:
1. **Facts** - Stable information about the user (name, location, occupation, preferences)
2. **Events** - Important moments (questions, problems, learnings, achievements)
3. **Conversation Summary** - Overall context and outcome

## Current User Profile:
${JSON.stringify(existingFacts, null, 2)}

## Extraction Rules:
- Extract ONLY NEW or UPDATED facts (don't repeat unchanged facts)
- Create events for significant interactions (importance score 1-10)
- Extract keywords for semantic search
- Identify technical topics and context
- Keep summaries concise (max 200 chars)

## Importance Scoring:
- 10: Critical personal info (name, location, occupation)
- 7-9: Important preferences, major problems/solutions
- 4-6: Normal questions, learning moments
- 1-3: Trivial interactions, casual chat

## Output Format (JSON only, no markdown):
{
  "facts": {
    "personal": {
      "name": "string (only if mentioned)",
      "location": "string (only if mentioned)",
      "occupation": "string (only if mentioned)",
      "company": "string (only if mentioned)"
    },
    "preferences": {
      "languages": ["string (programming languages)"],
      "topics": ["string (topics of interest)"],
      "frameworks": ["string (frameworks/tools)"],
      "communication_style": "string (e.g., technical, beginner-friendly)"
    },
    "technical_context": {
      "current_projects": ["string"],
      "frameworks": ["string"],
      "challenges": ["string"],
      "goals": ["string"]
    }
  },
  "events": [
    {
      "event_type": "question|problem|learning|preference|achievement|context",
      "summary": "Brief summary (max 200 chars)",
      "content": "Full context (optional)",
      "keywords": ["keyword1", "keyword2"],
      "importance_score": 5,
      "context": {}
    }
  ],
  "conversation_summary": {
    "title": "Brief title (max 100 chars)",
    "summary": "What was discussed (max 500 chars)",
    "key_topics": ["topic1", "topic2"],
    "technical_topics": ["Docker", "Redis", "Python"],
    "outcome": "resolved|ongoing|needs_followup"
  }
}

## Example 1:
User: "Tôi tên Thanh, đang làm developer tại Hà Nội"
Assistant: "Chào Thanh! Bạn cần giúp gì về công việc developer?"

Output:
{
  "facts": {
    "personal": { "name": "Thanh", "location": "Hà Nội", "occupation": "developer" },
    "preferences": {},
    "technical_context": {}
  },
  "events": [],
  "conversation_summary": {
    "title": "Giới thiệu - Developer tại Hà Nội",
    "summary": "User giới thiệu tên là Thanh, làm developer tại Hà Nội",
    "key_topics": ["introduction", "developer"],
    "technical_topics": [],
    "outcome": "ongoing"
  }
}

## Example 2:
User: "Làm sao để sort array trong Python?"
Assistant: "Có 2 cách: sorted() và .sort()..."

Output:
{
  "facts": {
    "personal": {},
    "preferences": { "languages": ["Python"] },
    "technical_context": {}
  },
  "events": [
    {
      "event_type": "question",
      "summary": "Asked about sorting arrays in Python",
      "content": "User wants to know how to sort arrays in Python",
      "keywords": ["python", "sort", "array", "list"],
      "importance_score": 5,
      "context": { "topic": "python basics" }
    }
  ],
  "conversation_summary": {
    "title": "Python array sorting",
    "summary": "User asked about array sorting methods in Python",
    "key_topics": ["python", "sorting", "arrays"],
    "technical_topics": ["Python"],
    "outcome": "resolved"
  }
}

## Important:
- Output ONLY valid JSON (no markdown, no explanation)
- If nothing significant to extract, return empty objects/arrays
- Don't extract trivial greetings or acknowledgments
- Focus on information that helps understand the user better

Analyze the conversation and output JSON:`;
}
export async function buildMemoryEnhancedPrompt(userId, currentMessage, baseSystemPrompt, options = {}) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return baseSystemPrompt;
        const { includeProfile = true, includeEvents = true, maxEvents = 5, minImportanceScore = 3, } = options;
        let enhancedPrompt = baseSystemPrompt + "\n\n";
        const context = await getMemoryContext(userId, currentMessage, {
            includeProfile,
            includeEvents,
            maxEvents,
            minImportanceScore,
        });
        if (includeProfile && context.profile && context.profile.facts) {
            const facts = context.profile.facts;
            let hasPersonalInfo = false;
            enhancedPrompt += "## About the User:\n";
            if (facts.personal) {
                const personal = facts.personal;
                if (personal.name) {
                    enhancedPrompt += `- Name: ${personal.name}\n`;
                    hasPersonalInfo = true;
                }
                if (personal.location) {
                    enhancedPrompt += `- Location: ${personal.location}\n`;
                    hasPersonalInfo = true;
                }
                if (personal.occupation) {
                    enhancedPrompt += `- Occupation: ${personal.occupation}\n`;
                    hasPersonalInfo = true;
                }
                if (personal.company) {
                    enhancedPrompt += `- Company: ${personal.company}\n`;
                    hasPersonalInfo = true;
                }
            }
            if (facts.preferences) {
                const prefs = facts.preferences;
                if (prefs.languages && prefs.languages.length > 0) {
                    enhancedPrompt += `- Programming Languages: ${prefs.languages.join(", ")}\n`;
                    hasPersonalInfo = true;
                }
                if (prefs.topics && prefs.topics.length > 0) {
                    enhancedPrompt += `- Interested Topics: ${prefs.topics.join(", ")}\n`;
                    hasPersonalInfo = true;
                }
                if (prefs.communication_style) {
                    enhancedPrompt += `- Communication Style: ${prefs.communication_style}\n`;
                    hasPersonalInfo = true;
                }
            }
            if (facts.technical_context) {
                const tech = facts.technical_context;
                if (tech.current_projects && tech.current_projects.length > 0) {
                    enhancedPrompt += `- Current Projects: ${tech.current_projects.join(", ")}\n`;
                    hasPersonalInfo = true;
                }
                if (tech.frameworks && tech.frameworks.length > 0) {
                    enhancedPrompt += `- Frameworks: ${tech.frameworks.join(", ")}\n`;
                    hasPersonalInfo = true;
                }
                if (tech.challenges && tech.challenges.length > 0) {
                    enhancedPrompt += `- Current Challenges: ${tech.challenges.join(", ")}\n`;
                    hasPersonalInfo = true;
                }
            }
            if (!hasPersonalInfo) {
                enhancedPrompt = enhancedPrompt.replace("## About the User:\n", "");
            }
            else {
                enhancedPrompt += "\n";
            }
        }
        if (includeEvents && context.relevantEvents && context.relevantEvents.length > 0) {
            enhancedPrompt += "## Relevant Past Interactions:\n";
            context.relevantEvents.forEach((event, idx) => {
                const similarity = event.similarity
                    ? ` (similarity: ${(event.similarity * 100).toFixed(0)}%)`
                    : "";
                enhancedPrompt += `${idx + 1}. [${event.event_type}] ${event.summary}${similarity}\n`;
            });
            enhancedPrompt += "\n";
        }
        enhancedPrompt += "## Instructions:\n";
        enhancedPrompt += "- Use the user context above to personalize your responses\n";
        enhancedPrompt += "- Reference past interactions when relevant\n";
        enhancedPrompt += "- Be helpful, concise, and respectful\n";
        enhancedPrompt +=
            "- If the user mentions something you already know, acknowledge it naturally\n";
        return enhancedPrompt;
    }
    catch (error) {
        return baseSystemPrompt;
    }
}
export async function getMemoryContext(userId, currentMessage, options = {}) {
    const { includeProfile = true, includeEvents = true, maxEvents = 5, minImportanceScore = 3, } = options;
    const context = {
        profile: null,
        relevantEvents: [],
        conversationSummaries: [],
    };
    try {
        if (includeProfile) {
            context.profile = await getUserProfile(userId);
        }
        if (includeEvents) {
            const allEvents = await getRelevantEvents(userId, currentMessage, maxEvents * 2);
            context.relevantEvents = allEvents
                .filter((e) => e.importance_score >= minImportanceScore)
                .slice(0, maxEvents);
        }
        return context;
    }
    catch (error) {
        return context;
    }
}
export async function generateChatSuggestions(userId) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return [];
        const summaries = await getRecentConversationSummaries(userId, 5);
        if (!summaries || summaries.length === 0) {
            return [];
        }
        const suggestionsPrompt = `Based on the user's recent conversations, suggest 3 relevant follow-up questions or topics.

Recent conversations:
${summaries.map((s, idx) => `${idx + 1}. ${s.title}: ${s.summary}`).join("\n")}

Generate 3 short, actionable suggestions (max 100 chars each).
Focus on:
- Unresolved issues or needs_followup conversations
- Natural next steps in learning/projects
- Relevant technical topics they're exploring

Output as JSON array only (no markdown):
["suggestion 1", "suggestion 2", "suggestion 3"]`;
        const response = await getChatCompletion({
            messages: [
                {
                    role: "system",
                    content: "You generate smart, relevant conversation suggestions. Output JSON only.",
                },
                { role: "user", content: suggestionsPrompt },
            ],
            model: LTM_CONFIG.META_MODEL,
            temperature: 0.7,
            max_completion_tokens: 300,
        });
        let content = response.content.trim();
        if (content.startsWith("```json")) {
            content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        }
        else if (content.startsWith("```")) {
            content = content.replace(/```\n?/g, "");
        }
        const suggestions = JSON.parse(content);
        return Array.isArray(suggestions) ? suggestions : [];
    }
    catch (error) {
        return [];
    }
}
export async function analyzeAndUpdateMemory(userId, conversationId, userMessage, assistantMessage) {
    try {
        if (!LTM_CONFIG.ENABLED)
            return;
        if (LTM_CONFIG.BACKGROUND_DELAY > 0) {
            await new Promise((resolve) => setTimeout(resolve, LTM_CONFIG.BACKGROUND_DELAY));
        }
        const currentProfile = await getUserProfile(userId);
        const analysis = await extractMemoryFromConversation({
            userId,
            conversationId,
            userMessage,
            assistantMessage,
            currentProfile,
        });
        if (analysis.facts && Object.keys(analysis.facts).length > 0) {
            const hasFactsToUpdate = (analysis.facts.personal && Object.keys(analysis.facts.personal).length > 0) ||
                (analysis.facts.preferences && Object.keys(analysis.facts.preferences).length > 0) ||
                (analysis.facts.technical_context &&
                    Object.keys(analysis.facts.technical_context).length > 0);
            if (hasFactsToUpdate) {
                await updateUserProfile(userId, analysis.facts);
            }
        }
        if (analysis.events && analysis.events.length > 0) {
            for (const event of analysis.events) {
                await createUserEvent(userId, conversationId, event);
            }
        }
        if (analysis.conversation_summary) {
            await updateConversationSummary(conversationId, {
                conversation_id: conversationId,
                ...analysis.conversation_summary,
            });
        }
        await pruneUserEvents(userId);
    }
    catch (error) {
    }
}
