# 🧠 Long Term Memory (LTM) System Design

## AI Chatbot Assistant - Memory Architecture

> **Mục tiêu**: Biến Chatbot thành một AI Assistant thực sự - nhớ thông tin user, hiểu ngữ cảnh qua nhiều cuộc hội thoại, và đưa ra gợi ý thông minh dựa trên lịch sử tương tác.

---

## 📋 Table of Contents

1. [Tổng quan hệ thống](#tổng-quan-hệ-thống)
2. [Kiến trúc dữ liệu](#kiến-trúc-dữ-liệu)
3. [Luồng hoạt động](#luồng-hoạt-động)
4. [Cài đặt chi tiết](#cài-đặt-chi-tiết)
5. [API Design](#api-design)
6. [Migration Plan](#migration-plan)
7. [Testing Strategy](#testing-strategy)

---

## 🎯 Tổng quan hệ thống

### Use Cases thực tế

**UC1: Ghi nhớ thông tin cá nhân**

```
User (Conversation 1): "Tôi tên là Thanh, đang làm developer tại Hà Nội"
AI: "Rất vui được gặp bạn Thanh! Bạn đang làm developer tại Hà Nội..."

User (Conversation 2 - ngày hôm sau): "Tôi đang ở đâu nhỉ?"
AI: "Theo thông tin bạn đã chia sẻ, bạn đang ở Hà Nội và làm developer đó bạn Thanh!"
```

**UC2: Hiểu ngữ cảnh kỹ thuật**

```
User (Conversation 1): "Làm sao để sort array trong Python?"
AI: [Giải thích về Python sorting...]

User (Conversation 2): "Còn trong Node.js thì sao?"
AI: "À, bạn muốn so sánh với Python đúng không? Trong Node.js (JavaScript),
     sorting array khác với Python ở chỗ..."
```

**UC3: Gợi ý câu hỏi thông minh**

```
User opens new chat:
AI: "👋 Chào bạn Thanh! Dựa trên các cuộc trò chuyện trước:
     • Bạn có muốn tiếp tục tìm hiểu về Docker deployment?
     • Hoặc bạn cần giúp debug Redis connection issue?
     • Tôi có thể giúp bạn tối ưu Python script đang làm dở không?"
```

---

## 🏗️ Kiến trúc dữ liệu

### 1. Redis - User Facts (Profile DB)

> **Vai trò**: Lưu trữ "Sự thật" về user - các thông tin ổn định, ít thay đổi

**Key Structure:**

```typescript
// Key pattern: user:{userId}:profile
{
  "user_id": "uuid-xxx",
  "facts": {
    "personal": {
      "name": "Thanh",
      "location": "Hà Nội",
      "occupation": "Developer",
      "company": "XGAME Studio"
    },
    "preferences": {
      "languages": ["Python", "Node.js", "TypeScript"],
      "topics": ["Docker", "Redis", "AI"],
      "communication_style": "technical, concise"
    },
    "technical_context": {
      "current_projects": ["AI Chatbot", "Docker Deployment"],
      "frameworks": ["Express", "React", "Vite"],
      "challenges": ["Redis integration", "Socket.io optimization"]
    }
  },
  "updated_at": "2025-11-04T10:30:00Z",
  "version": 1
}
```

**Redis Operations:**

```typescript
// Set/Update profile
await redis.set(
  `user:${userId}:profile`,
  JSON.stringify(profile),
  "EX",
  7 * 24 * 60 * 60 // 7 days TTL
);

// Get profile
const profileJson = await redis.get(`user:${userId}:profile`);
const profile = profileJson ? JSON.parse(profileJson) : null;

// Update specific fact
const profile = await getProfile(userId);
profile.facts.personal.location = "Đà Nẵng";
await redis.set(`user:${userId}:profile`, JSON.stringify(profile));
```

---

### 2. PostgreSQL - User Events (Events Log)

> **Vai trò**: Lưu trữ "Sự kiện" - các tương tác, ngữ cảnh, và timeline

**Database Schema:**

```sql
-- Table: user_memory_events
CREATE TABLE user_memory_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Event metadata
  event_type VARCHAR(50) NOT NULL, -- 'question', 'problem', 'learning', 'preference'
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Event content
  summary TEXT NOT NULL, -- Short summary of the event
  content TEXT, -- Full content (optional, for detailed context)
  keywords TEXT[] NOT NULL DEFAULT '{}', -- Keywords for searching
  embedding VECTOR(1536), -- OpenAI embedding for semantic search

  -- Context
  context JSONB DEFAULT '{}', -- Additional context data
  importance_score INTEGER DEFAULT 5, -- 1-10 scale

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  accessed_at TIMESTAMP DEFAULT NOW(), -- Last time this event was retrieved
  access_count INTEGER DEFAULT 0,

  -- Indexes
  INDEX idx_user_events_user_id (user_id),
  INDEX idx_user_events_keywords USING GIN(keywords),
  INDEX idx_user_events_created (created_at DESC),
  INDEX idx_user_events_importance (importance_score DESC),
  INDEX idx_user_events_embedding USING ivfflat(embedding vector_cosine_ops)
);

-- Table: user_conversation_summary
-- Summarizes entire conversations for quick context
CREATE TABLE user_conversation_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Summary
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  key_topics TEXT[] NOT NULL DEFAULT '{}',
  technical_topics TEXT[] DEFAULT '{}',

  -- Outcome
  outcome VARCHAR(100), -- 'resolved', 'ongoing', 'needs_followup'
  followup_suggestions TEXT[],

  -- Stats
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_conv_summary_user (user_id),
  INDEX idx_conv_summary_topics USING GIN(key_topics),
  UNIQUE(conversation_id)
);
```

---

## 🔄 Luồng hoạt động

### Flow 1: User gửi message → LTM Analysis

```
┌─────────────┐
│ User sends  │
│  message    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│ 1. LOAD MEMORY CONTEXT          │
│  - Get User Profile (Redis)     │
│  - Get Relevant Events (PG)     │
│  - Get Conversation Summary (PG)│
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ 2. BUILD ENHANCED PROMPT        │
│  System Prompt includes:        │
│  - User facts (name, prefs)     │
│  - Recent events context        │
│  - Current conversation context │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ 3. CALL OPENAI (Main LLM)       │
│  - Generate response            │
│  - Stream to client             │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ 4. BACKGROUND ANALYSIS          │
│  (Async - Non-blocking)         │
│  - Extract new facts            │
│  - Update Redis profile         │
│  - Create events in PG          │
│  - Generate embeddings          │
└─────────────────────────────────┘
```

### Flow 2: Memory Extraction (Background Process)

```typescript
// This runs AFTER sending response to user (non-blocking)
async function analyzeAndUpdateMemory(
  userId: string,
  conversationId: string,
  userMessage: string,
  assistantMessage: string
) {
  // Call Meta-LLM to extract memory
  const analysis = await extractMemoryFromConversation({
    userId,
    conversationId,
    userMessage,
    assistantMessage,
    currentProfile: await getProfile(userId),
  });

  // Update Redis profile with new facts
  if (analysis.facts && Object.keys(analysis.facts).length > 0) {
    await updateUserProfile(userId, analysis.facts);
  }

  // Create events in PostgreSQL
  if (analysis.events && analysis.events.length > 0) {
    await createUserEvents(userId, conversationId, analysis.events);
  }

  // Update conversation summary
  if (analysis.conversation_summary) {
    await updateConversationSummary(
      conversationId,
      analysis.conversation_summary
    );
  }
}
```

---

## 🛠️ Cài đặt chi tiết

### 1. Memory Service (`memory.service.ts`)

```typescript
import redisClient from "../config/redis.config.js";
import sequelize from "../db/database.config.js";
import { getChatCompletion } from "./openai.service.js";
import { generateEmbedding } from "./embedding.service.js";

/**
 * Memory Service
 * Handles Long Term Memory operations for users
 */

// ==================== REDIS OPERATIONS ====================

/**
 * Get user profile from Redis
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  try {
    const profileJson = await redisClient.get(`user:${userId}:profile`);
    if (!profileJson) return null;

    const profile = JSON.parse(profileJson);
    return profile;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

/**
 * Update user profile in Redis
 * Merges new facts with existing profile
 */
export async function updateUserProfile(
  userId: string,
  facts: Partial<UserFacts>
): Promise<void> {
  try {
    const current = (await getUserProfile(userId)) || {
      user_id: userId,
      facts: {
        personal: {},
        preferences: {},
        technical_context: {},
      },
      updated_at: new Date().toISOString(),
      version: 1,
    };

    // Deep merge facts
    current.facts = {
      personal: { ...current.facts.personal, ...facts.personal },
      preferences: {
        ...current.facts.preferences,
        ...facts.preferences,
        languages: mergeTags(
          current.facts.preferences?.languages,
          facts.preferences?.languages
        ),
        topics: mergeTags(
          current.facts.preferences?.topics,
          facts.preferences?.topics
        ),
      },
      technical_context: {
        ...current.facts.technical_context,
        ...facts.technical_context,
        current_projects: mergeTags(
          current.facts.technical_context?.current_projects,
          facts.technical_context?.current_projects
        ),
        frameworks: mergeTags(
          current.facts.technical_context?.frameworks,
          facts.technical_context?.frameworks
        ),
      },
    };

    current.updated_at = new Date().toISOString();
    current.version += 1;

    // Save to Redis with 7 days TTL
    await redisClient.set(
      `user:${userId}:profile`,
      JSON.stringify(current),
      "EX",
      7 * 24 * 60 * 60
    );
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
}

/**
 * Helper: Merge tag arrays (unique values)
 */
function mergeTags(existing?: string[], newTags?: string[]): string[] {
  const combined = [...(existing || []), ...(newTags || [])];
  return Array.from(new Set(combined));
}

// ==================== POSTGRESQL OPERATIONS ====================

/**
 * Create user memory event
 */
export async function createUserEvent(
  userId: string,
  conversationId: string,
  event: {
    event_type: string;
    summary: string;
    content?: string;
    keywords: string[];
    importance_score?: number;
    context?: Record<string, any>;
  }
): Promise<void> {
  try {
    // Generate embedding for semantic search
    let embedding = null;
    try {
      const embeddingVector = await generateEmbedding(event.summary);
      embedding = JSON.stringify(embeddingVector);
    } catch (err) {
      console.warn("Failed to generate embedding for event:", err);
    }

    await sequelize.query(
      `
      INSERT INTO user_memory_events (
        user_id, conversation_id, event_type, summary, 
        content, keywords, embedding, importance_score, context
      ) VALUES (
        :userId, :conversationId, :eventType, :summary,
        :content, :keywords, :embedding, :importanceScore, :context
      )
    `,
      {
        replacements: {
          userId,
          conversationId,
          eventType: event.event_type,
          summary: event.summary,
          content: event.content || null,
          keywords: event.keywords,
          embedding,
          importanceScore: event.importance_score || 5,
          context: JSON.stringify(event.context || {}),
        },
      }
    );
  } catch (error) {
    console.error("Error creating user event:", error);
    throw error;
  }
}

/**
 * Get relevant events for context
 */
export async function getRelevantEvents(
  userId: string,
  currentMessage: string,
  limit: number = 5
): Promise<any[]> {
  try {
    // Try semantic search first
    try {
      const embedding = await generateEmbedding(currentMessage);
      const embeddingStr = JSON.stringify(embedding);

      const [events] = await sequelize.query(
        `
        SELECT 
          id, event_type, summary, content, keywords, 
          importance_score, context, created_at,
          1 - (embedding <=> :embedding::vector) as similarity
        FROM user_memory_events
        WHERE user_id = :userId
          AND embedding IS NOT NULL
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
      `,
        {
          replacements: { userId, embedding: embeddingStr, limit },
        }
      );

      return events as any[];
    } catch (embeddingError) {
      // Fallback to keyword search
      console.warn("Semantic search failed, using keyword search");

      // Extract keywords from message
      const keywords = extractKeywords(currentMessage);

      const [events] = await sequelize.query(
        `
        SELECT 
          id, event_type, summary, content, keywords, 
          importance_score, context, created_at
        FROM user_memory_events
        WHERE user_id = :userId
          AND keywords && :keywords
        ORDER BY importance_score DESC, created_at DESC
        LIMIT :limit
      `,
        {
          replacements: { userId, keywords, limit },
        }
      );

      return events as any[];
    }
  } catch (error) {
    console.error("Error getting relevant events:", error);
    return [];
  }
}

/**
 * Update conversation summary
 */
export async function updateConversationSummary(
  conversationId: string,
  summary: {
    title?: string;
    summary?: string;
    key_topics?: string[];
    technical_topics?: string[];
    outcome?: string;
    followup_suggestions?: string[];
  }
): Promise<void> {
  try {
    // Get conversation and user_id
    const [conversations] = await sequelize.query(
      `
      SELECT user_id FROM conversations WHERE id = :conversationId
    `,
      {
        replacements: { conversationId },
      }
    );

    if (!conversations || (conversations as any[]).length === 0) {
      throw new Error("Conversation not found");
    }

    const userId = (conversations as any[])[0].user_id;

    // Upsert summary
    await sequelize.query(
      `
      INSERT INTO user_conversation_summary (
        user_id, conversation_id, title, summary, 
        key_topics, technical_topics, outcome, followup_suggestions
      ) VALUES (
        :userId, :conversationId, :title, :summary,
        :keyTopics, :technicalTopics, :outcome, :followupSuggestions
      )
      ON CONFLICT (conversation_id) 
      DO UPDATE SET
        title = COALESCE(EXCLUDED.title, user_conversation_summary.title),
        summary = COALESCE(EXCLUDED.summary, user_conversation_summary.summary),
        key_topics = COALESCE(EXCLUDED.key_topics, user_conversation_summary.key_topics),
        technical_topics = COALESCE(EXCLUDED.technical_topics, user_conversation_summary.technical_topics),
        outcome = COALESCE(EXCLUDED.outcome, user_conversation_summary.outcome),
        followup_suggestions = COALESCE(EXCLUDED.followup_suggestions, user_conversation_summary.followup_suggestions),
        updated_at = NOW()
    `,
      {
        replacements: {
          userId,
          conversationId,
          title: summary.title || null,
          summary: summary.summary || null,
          keyTopics: summary.key_topics || null,
          technicalTopics: summary.technical_topics || null,
          outcome: summary.outcome || null,
          followupSuggestions: summary.followup_suggestions || null,
        },
      }
    );
  } catch (error) {
    console.error("Error updating conversation summary:", error);
    throw error;
  }
}

/**
 * Get conversation summaries for suggestions
 */
export async function getRecentConversationSummaries(
  userId: string,
  limit: number = 5
): Promise<any[]> {
  try {
    const [summaries] = await sequelize.query(
      `
      SELECT 
        cs.conversation_id, cs.title, cs.summary, 
        cs.key_topics, cs.technical_topics, 
        cs.outcome, cs.followup_suggestions,
        c.updated_at
      FROM user_conversation_summary cs
      JOIN conversations c ON cs.conversation_id = c.id
      WHERE cs.user_id = :userId
        AND c.deleted_at IS NULL
      ORDER BY c.updated_at DESC
      LIMIT :limit
    `,
      {
        replacements: { userId, limit },
      }
    );

    return summaries as any[];
  } catch (error) {
    console.error("Error getting conversation summaries:", error);
    return [];
  }
}

// ==================== MEMORY ANALYSIS (Meta-LLM) ====================

/**
 * Extract memory from conversation using Meta-LLM
 */
export async function extractMemoryFromConversation(params: {
  userId: string;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  currentProfile: UserProfile | null;
}): Promise<MemoryAnalysis> {
  const {
    userId,
    conversationId,
    userMessage,
    assistantMessage,
    currentProfile,
  } = params;

  try {
    // Build Meta-LLM prompt
    const metaPrompt = buildMemoryExtractionPrompt(
      userMessage,
      assistantMessage,
      currentProfile
    );

    // Call OpenAI to analyze
    const response = await getChatCompletion({
      messages: [
        { role: "system", content: metaPrompt },
        {
          role: "user",
          content: `User: ${userMessage}\n\nAssistant: ${assistantMessage}`,
        },
      ],
      model: "gpt-4o-mini", // Use cheaper model for analysis
      temperature: 0.3, // Low temperature for consistent extraction
      max_completion_tokens: 1000,
    });

    // Parse JSON response
    const analysis = JSON.parse(response.content);
    return analysis;
  } catch (error) {
    console.error("Error extracting memory:", error);
    return {
      facts: {},
      events: [],
      conversation_summary: null,
    };
  }
}

/**
 * Build Meta-LLM prompt for memory extraction
 */
function buildMemoryExtractionPrompt(
  userMessage: string,
  assistantMessage: string,
  currentProfile: UserProfile | null
): string {
  const existingFacts = currentProfile?.facts || {};

  return `You are a Memory Extraction AI. Your job is to analyze conversations and extract:
1. **Facts** about the user (stable information like name, location, occupation, preferences)
2. **Events** (important moments, questions, problems, learnings)
3. **Conversation summary** (overall context and outcome)

## Current User Profile:
${JSON.stringify(existingFacts, null, 2)}

## Instructions:
- Extract ONLY NEW or UPDATED facts (don't repeat existing facts unless changed)
- Create events for important moments (questions, problems solved, new learnings)
- Assign importance score 1-10 (10 = critical personal info, 5 = normal, 1 = trivial)
- Extract keywords for semantic search
- Identify technical topics and context

## Output Format (JSON):
\`\`\`json
{
  "facts": {
    "personal": {
      "name": "string (if mentioned)",
      "location": "string",
      "occupation": "string"
    },
    "preferences": {
      "languages": ["string"],
      "topics": ["string"],
      "communication_style": "string"
    },
    "technical_context": {
      "current_projects": ["string"],
      "frameworks": ["string"],
      "challenges": ["string"]
    }
  },
  "events": [
    {
      "event_type": "question|problem|learning|preference",
      "summary": "Short summary (max 200 chars)",
      "content": "Full context (optional)",
      "keywords": ["keyword1", "keyword2"],
      "importance_score": 5,
      "context": { "key": "value" }
    }
  ],
  "conversation_summary": {
    "title": "Brief title for this exchange",
    "summary": "What was discussed",
    "key_topics": ["topic1", "topic2"],
    "technical_topics": ["Docker", "Redis"],
    "outcome": "resolved|ongoing|needs_followup"
  }
}
\`\`\`

## Example:
User: "Tôi tên Thanh, đang làm việc với Docker"
Assistant: "Chào Thanh! Bạn cần giúp gì về Docker?"

Output:
\`\`\`json
{
  "facts": {
    "personal": { "name": "Thanh" },
    "technical_context": { "frameworks": ["Docker"] }
  },
  "events": [],
  "conversation_summary": {
    "title": "Giới thiệu và Docker",
    "summary": "User giới thiệu tên và framework đang dùng",
    "key_topics": ["introduction", "Docker"],
    "technical_topics": ["Docker"],
    "outcome": "ongoing"
  }
}
\`\`\`

Analyze the conversation below and output JSON only (no markdown, no explanation):`;
}

// ==================== CONTEXT BUILDING ====================

/**
 * Build enhanced prompt with memory context
 */
export async function buildMemoryEnhancedPrompt(
  userId: string,
  currentMessage: string,
  baseSystemPrompt: string
): Promise<string> {
  try {
    // Get user profile
    const profile = await getUserProfile(userId);

    // Get relevant events
    const events = await getRelevantEvents(userId, currentMessage, 5);

    // Build enhanced system prompt
    let enhancedPrompt = baseSystemPrompt + "\n\n";

    // Add user context
    if (profile && profile.facts) {
      enhancedPrompt += "## About the User:\n";

      if (profile.facts.personal) {
        const personal = profile.facts.personal;
        if (personal.name) {
          enhancedPrompt += `- Name: ${personal.name}\n`;
        }
        if (personal.location) {
          enhancedPrompt += `- Location: ${personal.location}\n`;
        }
        if (personal.occupation) {
          enhancedPrompt += `- Occupation: ${personal.occupation}\n`;
        }
      }

      if (profile.facts.preferences) {
        const prefs = profile.facts.preferences;
        if (prefs.languages && prefs.languages.length > 0) {
          enhancedPrompt += `- Programming Languages: ${prefs.languages.join(
            ", "
          )}\n`;
        }
        if (prefs.topics && prefs.topics.length > 0) {
          enhancedPrompt += `- Interested Topics: ${prefs.topics.join(", ")}\n`;
        }
      }

      if (profile.facts.technical_context) {
        const tech = profile.facts.technical_context;
        if (tech.current_projects && tech.current_projects.length > 0) {
          enhancedPrompt += `- Current Projects: ${tech.current_projects.join(
            ", "
          )}\n`;
        }
        if (tech.frameworks && tech.frameworks.length > 0) {
          enhancedPrompt += `- Frameworks: ${tech.frameworks.join(", ")}\n`;
        }
      }

      enhancedPrompt += "\n";
    }

    // Add relevant past events
    if (events && events.length > 0) {
      enhancedPrompt += "## Relevant Past Interactions:\n";
      events.forEach((event, idx) => {
        enhancedPrompt += `${idx + 1}. [${event.event_type}] ${
          event.summary
        }\n`;
      });
      enhancedPrompt += "\n";
    }

    enhancedPrompt += "## Instructions:\n";
    enhancedPrompt +=
      "- Use the user context above to personalize your responses\n";
    enhancedPrompt += "- Reference past interactions when relevant\n";
    enhancedPrompt += "- Be concise and helpful\n";

    return enhancedPrompt;
  } catch (error) {
    console.error("Error building memory-enhanced prompt:", error);
    return baseSystemPrompt; // Fallback to base prompt
  }
}

// ==================== SUGGESTION GENERATION ====================

/**
 * Generate smart suggestions for new chat
 */
export async function generateChatSuggestions(
  userId: string
): Promise<string[]> {
  try {
    // Get recent conversation summaries
    const summaries = await getRecentConversationSummaries(userId, 5);

    if (!summaries || summaries.length === 0) {
      return [];
    }

    // Build prompt for suggestion generation
    const suggestionsPrompt = `Based on the user's recent conversations, suggest 3 relevant follow-up questions or topics they might want to explore.

Recent conversations:
${summaries.map((s, idx) => `${idx + 1}. ${s.title}: ${s.summary}`).join("\n")}

Generate 3 short, actionable suggestions (max 100 chars each). Output as JSON array:
["suggestion 1", "suggestion 2", "suggestion 3"]`;

    const response = await getChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI that generates smart conversation suggestions.",
        },
        { role: "user", content: suggestionsPrompt },
      ],
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_completion_tokens: 300,
    });

    const suggestions = JSON.parse(response.content);
    return suggestions;
  } catch (error) {
    console.error("Error generating chat suggestions:", error);
    return [];
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction (can be improved with NLP)
  const words = text
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);

  // Remove common words
  const stopWords = [
    "this",
    "that",
    "with",
    "from",
    "have",
    "what",
    "when",
    "where",
  ];
  return Array.from(
    new Set(words.filter((word) => !stopWords.includes(word)))
  ).slice(0, 10);
}

// ==================== TYPE DEFINITIONS ====================

export interface UserProfile {
  user_id: string;
  facts: UserFacts;
  updated_at: string;
  version: number;
}

export interface UserFacts {
  personal?: {
    name?: string;
    location?: string;
    occupation?: string;
    company?: string;
  };
  preferences?: {
    languages?: string[];
    topics?: string[];
    communication_style?: string;
  };
  technical_context?: {
    current_projects?: string[];
    frameworks?: string[];
    challenges?: string[];
  };
}

export interface MemoryAnalysis {
  facts: Partial<UserFacts>;
  events: Array<{
    event_type: string;
    summary: string;
    content?: string;
    keywords: string[];
    importance_score?: number;
    context?: Record<string, any>;
  }>;
  conversation_summary: {
    title?: string;
    summary?: string;
    key_topics?: string[];
    technical_topics?: string[];
    outcome?: string;
    followup_suggestions?: string[];
  } | null;
}
```

---

### 2. Integration với Socket Service

**Update `socket.service.ts`:**

```typescript
// Import memory service
import {
  buildMemoryEnhancedPrompt,
  extractMemoryFromConversation,
} from "./memory.service.js";

// In message:send handler, BEFORE calling OpenAI:
socket.on("message:send", async (data) => {
  // ... existing code ...

  try {
    // STEP 1: Load memory context and build enhanced prompt
    const baseSystemPrompt = "You are a helpful AI assistant...";
    const enhancedSystemPrompt = await buildMemoryEnhancedPrompt(
      socket.userId!,
      content,
      baseSystemPrompt
    );

    // STEP 2: Send message with enhanced context
    const result = await sendMessageAndStreamResponse(
      conversationId,
      socket.userId!,
      content,
      onChunk,
      onUserMessageCreated,
      enrichedAttachments,
      enhancedSystemPrompt // Pass enhanced prompt
    );

    // STEP 3: Background memory analysis (non-blocking)
    // Don't await - let it run in background
    analyzeAndUpdateMemory(
      socket.userId!,
      conversationId,
      content,
      result.assistantMessage.content
    ).catch((err) => {
      console.error("Background memory analysis failed:", err);
    });

    // ... rest of code ...
  } catch (error) {
    // ... error handling ...
  }
});

/**
 * Background memory analysis (non-blocking)
 */
async function analyzeAndUpdateMemory(
  userId: string,
  conversationId: string,
  userMessage: string,
  assistantMessage: string
) {
  try {
    const currentProfile = await getUserProfile(userId);

    const analysis = await extractMemoryFromConversation({
      userId,
      conversationId,
      userMessage,
      assistantMessage,
      currentProfile,
    });

    // Update profile if new facts
    if (analysis.facts && Object.keys(analysis.facts).length > 0) {
      await updateUserProfile(userId, analysis.facts);
    }

    // Create events
    if (analysis.events && analysis.events.length > 0) {
      for (const event of analysis.events) {
        await createUserEvent(userId, conversationId, event);
      }
    }

    // Update conversation summary
    if (analysis.conversation_summary) {
      await updateConversationSummary(
        conversationId,
        analysis.conversation_summary
      );
    }
  } catch (error) {
    console.error("Memory analysis error:", error);
  }
}
```

---

### 3. Database Migration

**Create migration file: `create-ltm-tables.sql`**

```sql
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: user_memory_events
CREATE TABLE IF NOT EXISTS user_memory_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Event metadata
  event_type VARCHAR(50) NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Event content
  summary TEXT NOT NULL,
  content TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  embedding VECTOR(1536),

  -- Context
  context JSONB DEFAULT '{}',
  importance_score INTEGER DEFAULT 5,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  accessed_at TIMESTAMP DEFAULT NOW(),
  access_count INTEGER DEFAULT 0
);

-- Indexes for user_memory_events
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_memory_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_keywords ON user_memory_events USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_user_events_created ON user_memory_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_importance ON user_memory_events(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_embedding ON user_memory_events USING ivfflat(embedding vector_cosine_ops);

-- Table: user_conversation_summary
CREATE TABLE IF NOT EXISTS user_conversation_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Summary
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  key_topics TEXT[] NOT NULL DEFAULT '{}',
  technical_topics TEXT[] DEFAULT '{}',

  -- Outcome
  outcome VARCHAR(100),
  followup_suggestions TEXT[],

  -- Stats
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(conversation_id)
);

-- Indexes for user_conversation_summary
CREATE INDEX IF NOT EXISTS idx_conv_summary_user ON user_conversation_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_summary_topics ON user_conversation_summary USING GIN(key_topics);
CREATE INDEX IF NOT EXISTS idx_conv_summary_updated ON user_conversation_summary(updated_at DESC);
```

---

## 🌐 API Design

### 1. Get User Profile

```typescript
GET /api/memory/profile

Response:
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "facts": {
      "personal": { ... },
      "preferences": { ... },
      "technical_context": { ... }
    },
    "updated_at": "2025-11-04T10:30:00Z",
    "version": 1
  }
}
```

### 2. Get Chat Suggestions

```typescript
GET /api/memory/suggestions

Response:
{
  "success": true,
  "data": {
    "suggestions": [
      "Bạn muốn tiếp tục tìm hiểu về Docker deployment?",
      "Cần giúp debug Redis connection issue không?",
      "Tối ưu Python script đang làm dở?"
    ],
    "recent_topics": ["Docker", "Redis", "Python"],
    "recent_conversations": [...]
  }
}
```

### 3. Get Memory Events

```typescript
GET /api/memory/events?limit=10

Response:
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid",
        "event_type": "question",
        "summary": "Asked about Python sorting",
        "keywords": ["python", "sorting", "array"],
        "importance_score": 5,
        "created_at": "2025-11-03T14:20:00Z"
      }
    ],
    "total": 45
  }
}
```

---

## 📊 Migration Plan

### Phase 1: Infrastructure Setup (Week 1)

- [x] Install pgvector extension
- [ ] Create database tables (migration)
- [ ] Update Redis schema
- [ ] Test Redis + PostgreSQL connections

### Phase 2: Core Memory Service (Week 2)

- [ ] Implement `memory.service.ts`
- [ ] Create Meta-LLM prompts
- [ ] Test memory extraction
- [ ] Implement profile updates

### Phase 3: Integration (Week 3)

- [ ] Integrate with socket.service
- [ ] Update context builder
- [ ] Add background processing
- [ ] Test end-to-end flow

### Phase 4: API & UI (Week 4)

- [ ] Create memory API endpoints
- [ ] Build UI for profile view
- [ ] Add chat suggestions
- [ ] User testing

### Phase 5: Optimization (Week 5)

- [ ] Performance tuning
- [ ] Caching optimization
- [ ] Monitoring & logging
- [ ] Production deployment

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// memory.service.test.ts
describe("Memory Service", () => {
  test("should extract facts from conversation", async () => {
    const analysis = await extractMemoryFromConversation({
      userId: "test-user",
      conversationId: "test-conv",
      userMessage: "My name is John",
      assistantMessage: "Nice to meet you John!",
      currentProfile: null,
    });

    expect(analysis.facts.personal.name).toBe("John");
  });

  test("should merge facts without duplicates", async () => {
    // ... test code
  });
});
```

### Integration Tests

```typescript
// memory-integration.test.ts
describe("Memory Integration", () => {
  test("should load memory context before sending message", async () => {
    // ... test code
  });

  test("should update memory after message completion", async () => {
    // ... test code
  });
});
```

---

## 🚀 Environment Variables

Add to `.env`:

```bash
# Long Term Memory Settings
LTM_ENABLED=true
LTM_REDIS_TTL=604800  # 7 days
LTM_META_MODEL=gpt-4o-mini
LTM_MAX_EVENTS=100
LTM_BACKGROUND_DELAY=2000  # 2 seconds delay before analysis
```

---

## 📈 Performance Considerations

1. **Non-blocking Background Processing**: Memory analysis runs AFTER sending response
2. **Redis Caching**: Profile data cached with 7-day TTL
3. **Batch Operations**: Group multiple memory updates
4. **Lazy Loading**: Load memory only when needed
5. **Query Optimization**: Use indexes for fast event retrieval

---

## 🔒 Privacy & Security

1. **Data Retention**: Auto-expire memory after 30 days of inactivity
2. **User Control**: Add "Clear Memory" button in settings
3. **GDPR Compliance**: Allow users to export/delete their memory data
4. **Encryption**: Encrypt sensitive facts in Redis

---

## 📝 Next Steps

1. Review this design document
2. Create database migration script
3. Implement `memory.service.ts`
4. Test with sample conversations
5. Deploy to staging environment

---

## 🤝 Contributing

This is a living document. Please update as implementation progresses.

**Version**: 1.0  
**Last Updated**: 2025-11-04  
**Author**: AI Chatbot Team
