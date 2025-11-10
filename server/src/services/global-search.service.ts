import sequelize from "../db/database.config.js";
import { QueryTypes } from "sequelize";
import Message from "../models/message.model.js";
import MessageEmbedding from "../models/message-embedding.model.js";
import Conversation from "../models/conversation.model.js";
import { generateEmbedding } from "./embedding.service.js";
import type { SemanticSearchResult } from "../types/embedding.type.js";
import User from "../models/user.model.js";

/**
 * Global search result for a conversation
 */
export interface GlobalSearchConversationResult {
  conversation_id: string;
  conversation_title: string;
  max_similarity: number; // Highest similarity score in this conversation
  message_count: number; // Total messages matching
  top_messages: SemanticSearchResult[]; // Top N most relevant messages
  updated_at: Date;
}

/**
 * Global search response
 */
export interface GlobalSearchResponse {
  query: string;
  results: GlobalSearchConversationResult[];
  totalConversations: number;
}

/**
 * Search with context result
 */
export interface SearchWithContextResult {
  query: string;
  bestMatch: SemanticSearchResult | null;
  results: Array<{
    match: SemanticSearchResult;
    contextBefore: SemanticSearchResult[];
    contextAfter: SemanticSearchResult[];
  }>;
}

/**
 * Search across all user's conversations
 * Groups results by conversation and returns top conversations
 *
 * @param userId - User ID to search within
 * @param searchParams - Search parameters
 * @returns Promise with grouped search results
 */
export async function searchAllConversations(
  userIdOrEmail: string,
  searchParams: {
    query: string;
    tags?: string[]; // Optional: filter by conversation tags (match any tag)
    limit?: number; // Max conversations to return (default: 10)
    messagesPerConversation?: number; // Top messages per conversation (default: 3)
    similarity_threshold?: number; // Minimum similarity (default: 0.5, tuned for Vietnamese text with text-embedding-3-small)
  }
): Promise<GlobalSearchResponse> {
  const {
    query,
    tags,
    limit = 10,
    messagesPerConversation = 3,
    similarity_threshold = 0.37, // Lowered default to 0.4 for better recall on short Vietnamese queries
  } = searchParams;

  // Resolve user id if an email was passed
  let userId = userIdOrEmail;
  if (userIdOrEmail && userIdOrEmail.includes && userIdOrEmail.includes("@")) {
    const userRecord = await User.findOne({ where: { email: userIdOrEmail } });
    if (!userRecord) {
      throw new Error("User not found");
    }
    userId = userRecord.id;
  }

  // Validate input
  if (!query || query.trim().length === 0) {
    throw new Error("Search query cannot be empty");
  }

  // Generate embedding for search query
  const queryEmbedding = await generateEmbedding(query.trim());
  const vectorString = `[${queryEmbedding.join(",")}]`;

  // Step 1: Find all matching messages across user's conversations
  // Group by conversation and get top messages per conversation
  // If tags are provided, only search in conversations that have at least one of the tags
  let results;

  console.log("[GlobalSearch.Service] Query parameters:", {
    userId,
    queryLength: query.trim().length,
    tags,
    tagsCount: tags?.length || 0,
    limit,
    messagesPerConversation,
    similarity_threshold,
  });

  if (tags && tags.length > 0) {
    console.log(
      "[GlobalSearch.Service] Tag filtering enabled - searching conversations with tags:",
      tags
    );

    // DEBUG: Show ALL user's conversations with their tags
    const allUserConversations = await sequelize.query(
      `
      SELECT id, title, tags 
      FROM conversations 
      WHERE user_id = $1 
        AND deleted_at IS NULL 
        AND project_id IS NULL
      ORDER BY "updatedAt" DESC
      LIMIT 20
      `,
      {
        bind: [userId],
        type: QueryTypes.SELECT,
      }
    );

    console.log("[GlobalSearch.Service] ALL user conversations (for debugging):", {
      count: allUserConversations.length,
      conversations: allUserConversations,
    });

    // CRITICAL: First, verify which conversations have the specified tags
    const tagFilterCheck = await sequelize.query(
      `
      SELECT id, title, tags 
      FROM conversations 
      WHERE user_id = $1 
        AND deleted_at IS NULL 
        AND project_id IS NULL
        AND tags && $2::text[]
      `,
      {
        bind: [userId, tags],
        type: QueryTypes.SELECT,
      }
    );

    console.log("[GlobalSearch.Service] Conversations with matching tags:", {
      searchingForTags: tags,
      count: tagFilterCheck.length,
      conversations: tagFilterCheck,
    });

    // If NO conversations have the specified tags, return empty result immediately
    // DO NOT fallback to searching all conversations
    if (tagFilterCheck.length === 0) {
      console.log(
        "[GlobalSearch.Service] No conversations found with specified tags - returning empty result"
      );
      return {
        query: query.trim(),
        results: [],
        totalConversations: 0,
      };
    }

    // Filter by tags - conversation must have at least one of the specified tags
    results = await sequelize.query(
      `
      WITH user_conversations AS (
        SELECT id FROM conversations 
        WHERE user_id = $1 
          AND deleted_at IS NULL 
          AND project_id IS NULL
          AND tags && $5::text[]
      ),
      ranked_messages AS (
        SELECT 
          m.id as message_id,
          m.conversation_id,
          m.role,
          m.content,
          m.tokens_used,
          m.model,
          m."createdAt",
          (1 - (e.embedding <=> $2::vector)) as similarity,
          ROW_NUMBER() OVER (
            PARTITION BY m.conversation_id 
            ORDER BY (e.embedding <=> $2::vector) ASC
          ) as rank_in_conversation
        FROM messages m
        INNER JOIN message_embeddings e ON m.id = e.message_id
        WHERE m.conversation_id IN (SELECT id FROM user_conversations)
          AND (1 - (e.embedding <=> $2::vector)) >= $3
      )
      SELECT * FROM ranked_messages
      WHERE rank_in_conversation <= $4
      ORDER BY similarity DESC
      `,
      {
        bind: [userId, vectorString, similarity_threshold, messagesPerConversation, tags],
        type: QueryTypes.SELECT,
      }
    );
  } else {
    console.log("[GlobalSearch.Service] No tag filter - searching all conversations");
    // No tag filter - search all conversations
    results = await sequelize.query(
      `
      WITH user_conversations AS (
        SELECT id FROM conversations 
        WHERE user_id = $1 AND deleted_at IS NULL AND project_id IS NULL
      ),
      ranked_messages AS (
        SELECT 
          m.id as message_id,
          m.conversation_id,
          m.role,
          m.content,
          m.tokens_used,
          m.model,
          m."createdAt",
          (1 - (e.embedding <=> $2::vector)) as similarity,
          ROW_NUMBER() OVER (
            PARTITION BY m.conversation_id 
            ORDER BY (e.embedding <=> $2::vector) ASC
          ) as rank_in_conversation
        FROM messages m
        INNER JOIN message_embeddings e ON m.id = e.message_id
        WHERE m.conversation_id IN (SELECT id FROM user_conversations)
          AND (1 - (e.embedding <=> $2::vector)) >= $3
      )
      SELECT * FROM ranked_messages
      WHERE rank_in_conversation <= $4
      ORDER BY similarity DESC
      `,
      {
        bind: [userId, vectorString, similarity_threshold, messagesPerConversation],
        type: QueryTypes.SELECT,
      }
    );
  }

  console.log("[GlobalSearch.Service] Raw query results:", {
    resultCount: results.length,
    sampleResults: results.slice(0, 3),
  });

  if (results.length === 0) {
    console.log("[GlobalSearch.Service] No results found - empty result set returned");
    return {
      query: query.trim(),
      results: [],
      totalConversations: 0,
    };
  }

  // Step 2: Group results by conversation
  const conversationMap = new Map<
    string,
    {
      messages: SemanticSearchResult[];
      maxSimilarity: number;
    }
  >();

  for (const row of results as any[]) {
    const conversationId = row.conversation_id;
    const message: SemanticSearchResult = {
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      role: row.role as "user" | "assistant" | "system",
      content: row.content,
      similarity: parseFloat(row.similarity) || 0,
      tokens_used: row.tokens_used || 0,
      model: row.model || "unknown",
      createdAt: row.createdAt || new Date(),
    };

    if (!conversationMap.has(conversationId)) {
      conversationMap.set(conversationId, {
        messages: [],
        maxSimilarity: message.similarity,
      });
    }

    const convData = conversationMap.get(conversationId)!;
    convData.messages.push(message);
    convData.maxSimilarity = Math.max(convData.maxSimilarity, message.similarity);
  }

  // Step 3: Get conversation details and sort by max similarity
  const conversationIds = Array.from(conversationMap.keys());

  console.log("[GlobalSearch.Service] Found conversations:", {
    conversationCount: conversationIds.length,
    conversationIds: conversationIds,
  });

  const conversations = await Conversation.findAll({
    where: {
      id: conversationIds,
    },
    attributes: ["id", "title", "updatedAt", "tags"],
  });

  console.log("[GlobalSearch.Service] Conversation details with tags:", {
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      tags: c.tags,
    })),
  });

  const conversationResults: GlobalSearchConversationResult[] = conversations.map((conv) => {
    const data = conversationMap.get(conv.id)!;
    return {
      conversation_id: conv.id,
      conversation_title: conv.title,
      max_similarity: data.maxSimilarity,
      message_count: data.messages.length,
      top_messages: data.messages,
      updated_at: conv.updatedAt,
    };
  });

  // Sort by max similarity (highest first)
  conversationResults.sort((a, b) => b.max_similarity - a.max_similarity);

  // Limit results
  const limitedResults = conversationResults.slice(0, limit);

  console.log("[GlobalSearch.Service] Final results:", {
    totalFound: conversationResults.length,
    limitedTo: limitedResults.length,
    titles: limitedResults.map((r) => r.conversation_title),
  });

  return {
    query: query.trim(),
    results: limitedResults,
    totalConversations: conversationResults.length,
  };
}

/**
 * Search within a specific conversation with surrounding context
 * Returns the best match plus context messages before and after
 *
 * @param conversationId - Conversation ID to search within
 * @param userId - User ID for authorization
 * @param searchParams - Search parameters
 * @returns Promise with search results including context
 */
export async function searchWithinConversation(
  conversationId: string,
  userIdOrEmail: string,
  searchParams: {
    query: string;
    limit?: number; // Max results (default: 5)
    contextMessages?: number; // Messages before/after for context (default: 2)
    similarity_threshold?: number; // Minimum similarity (default: 0.5, tuned for Vietnamese)
  }
): Promise<SearchWithContextResult> {
  const { query, limit = 5, contextMessages = 2, similarity_threshold = 0.37 } = searchParams; // Lowered from 0.7 to 0.5

  // Resolve user id if an email was passed
  let userId = userIdOrEmail;
  if (userIdOrEmail && userIdOrEmail.includes && userIdOrEmail.includes("@")) {
    const userRecord = await User.findOne({ where: { email: userIdOrEmail } });
    if (!userRecord) {
      throw new Error("User not found");
    }
    userId = userRecord.id;
  }

  // Verify conversation exists and user has access
  const conversation = await Conversation.findOne({
    where: {
      id: conversationId,
      deleted_at: null,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to conversation");
  }

  // Generate embedding for search query
  const queryEmbedding = await generateEmbedding(query.trim());
  const vectorString = `[${queryEmbedding.join(",")}]`;

  // First, check how many messages exist in this conversation and how many have embeddings
  const statsQuery = await sequelize.query(
    `
    SELECT 
      COUNT(DISTINCT m.id) as total_messages,
      COUNT(DISTINCT e.message_id) as messages_with_embeddings
    FROM messages m
    LEFT JOIN message_embeddings e ON m.id = e.message_id
    WHERE m.conversation_id = $1
    `,
    {
      bind: [conversationId],
      type: QueryTypes.SELECT,
    }
  );

  // Find matching messages
  const results = await sequelize.query(
    `
    SELECT 
      m.id as message_id,
      m.conversation_id,
      m.role,
      m.content,
      m.tokens_used,
      m.model,
      m."createdAt",
      (1 - (e.embedding <=> $1::vector)) as similarity
    FROM messages m
    INNER JOIN message_embeddings e ON m.id = e.message_id
    WHERE m.conversation_id = $2
      AND (1 - (e.embedding <=> $1::vector)) >= $3
    ORDER BY e.embedding <=> $1::vector ASC
    LIMIT $4
    `,
    {
      bind: [vectorString, conversationId, similarity_threshold, limit],
      type: QueryTypes.SELECT,
    }
  );

  // If no results found but there are messages with embeddings, try without threshold to see top matches
  if (
    results.length === 0 &&
    statsQuery[0] &&
    (statsQuery[0] as any).messages_with_embeddings > 0
  ) {
    const topMatches = await sequelize.query(
      `
      SELECT 
        m.id as message_id,
        m.content,
        (1 - (e.embedding <=> $1::vector)) as similarity
      FROM messages m
      INNER JOIN message_embeddings e ON m.id = e.message_id
      WHERE m.conversation_id = $2
      ORDER BY e.embedding <=> $1::vector ASC
      LIMIT $3
      `,
      {
        bind: [vectorString, conversationId, limit],
        type: QueryTypes.SELECT,
      }
    );
  }

  // If still no semantic results, try a plain text fallback (case-insensitive substring match)
  if (results.length === 0) {
    const textQuery = `%${query.trim()}%`;
    const textMatches = await sequelize.query(
      `
      SELECT 
        m.id as message_id,
        m.conversation_id,
        m.role,
        m.content,
        m.tokens_used,
        m.model,
        m."createdAt",
        NULL::text as similarity
      FROM messages m
      WHERE m.conversation_id = $1
        AND m.content ILIKE $2
      ORDER BY m."createdAt" DESC
      LIMIT $3
      `,
      {
        bind: [conversationId, textQuery, limit],
        type: QueryTypes.SELECT,
      }
    );

    if ((textMatches as any[]).length > 0) {
      // Prepare results in same shape as semantic query results (similarity set to 0)
      const prepared = (textMatches as any[]).map((r) => ({
        ...r,
        similarity: 0,
      }));
      // Use these as the results so the rest of the function builds context as usual
      // @ts-ignore - assign to results variable from earlier
      results.splice(0, results.length, ...prepared);
    }
  }

  if (results.length === 0) {
    return {
      query: query.trim(),
      bestMatch: null,
      results: [],
    };
  }

  const matches: SemanticSearchResult[] = (results as any[]).map((row: any) => ({
    message_id: row.message_id,
    conversation_id: row.conversation_id,
    role: row.role as "user" | "assistant" | "system",
    content: row.content,
    similarity: parseFloat(row.similarity) || 0,
    tokens_used: row.tokens_used || 0,
    model: row.model || "unknown",
    createdAt: row.createdAt || new Date(),
  }));

  // Get all messages in conversation for context
  const allMessages = await Message.findAll({
    where: { conversation_id: conversationId },
    order: [["createdAt", "ASC"]],
    attributes: ["id", "role", "content", "tokens_used", "model", "createdAt", "conversation_id"],
  });

  // Build results with context
  const resultsWithContext = matches.map((match) => {
    // Find index of this message in all messages
    const messageIndex = allMessages.findIndex((m) => m.id === match.message_id);

    // Get context before
    const contextBefore: SemanticSearchResult[] = [];
    for (let i = Math.max(0, messageIndex - contextMessages); i < messageIndex; i++) {
      const msg = allMessages[i];
      contextBefore.push({
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
        similarity: 0, // Context messages don't have similarity scores
        tokens_used: msg.tokens_used,
        model: msg.model,
        createdAt: msg.createdAt,
      });
    }

    // Get context after
    const contextAfter: SemanticSearchResult[] = [];
    for (
      let i = messageIndex + 1;
      i < Math.min(allMessages.length, messageIndex + contextMessages + 1);
      i++
    ) {
      const msg = allMessages[i];
      contextAfter.push({
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
        similarity: 0,
        tokens_used: msg.tokens_used,
        model: msg.model,
        createdAt: msg.createdAt,
      });
    }

    return {
      match,
      contextBefore,
      contextAfter,
    };
  });

  return {
    query: query.trim(),
    bestMatch: matches.length > 0 ? matches[0] : null,
    results: resultsWithContext,
  };
}

export default {
  searchAllConversations,
  searchWithinConversation,
};
