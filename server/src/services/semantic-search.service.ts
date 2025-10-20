import sequelize from "../db/database.config.js";
import { QueryTypes } from "sequelize";
import Message from "../models/message.model.js";
import MessageEmbedding from "../models/message-embedding.model.js";
import Conversation from "../models/conversation.model.js";
import { generateEmbedding } from "./embedding.service.js";
import type {
  SemanticSearchResult,
  SemanticSearchRequest,
  SemanticSearchResponse,
} from "../types/embedding.type.js";
import { cacheAside, CACHE_TTL } from "./cache.service.js";
import { semanticSearchKey } from "../utils/cache-key.util.js";

/**
 * Perform semantic search on messages within a conversation
 * Uses cosine similarity to find messages most similar to the query
 *
 * Process:
 * 1. Generate embedding for search query
 * 2. Calculate cosine similarity with all message embeddings in conversation
 * 3. Return top N most similar messages with similarity scores
 *
 * @param conversationId - Conversation ID to search within
 * @param userId - User ID (for authorization check)
 * @param searchParams - Search parameters (query, limit, threshold)
 * @returns Promise with search results
 * @throws Error if conversation not found or user unauthorized
 */
export async function searchConversationByEmbedding(
  conversationId: string,
  userId: string,
  searchParams: SemanticSearchRequest
): Promise<SemanticSearchResponse> {
  const { query, limit = 5, similarity_threshold = 0.37 } = searchParams;

  // Validate input
  if (!query || query.trim().length === 0) {
    throw new Error("Search query cannot be empty");
  }
  // Use cache for semantic search results
  const cacheKey = semanticSearchKey(conversationId, query, limit, similarity_threshold);
  const performSearch = async () => {
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

    // Convert embedding array to PostgreSQL vector format
    // Format: '[1.0, 2.0, 3.0, ...]'
    const vectorString = `[${queryEmbedding.join(",")}]`;
    const searchStartTime = Date.now();

    // Perform semantic search using PostgreSQL vector operations
    // Cosine similarity operator: <=>
    // Formula: 1 - cosine_distance = similarity (range: 0-1, where 1 is identical)
    //
    // This query:
    // 1. Joins messages with their embeddings
    // 2. Calculates cosine similarity between query and each message
    // 3. Filters by conversation ID and similarity threshold
    // 4. Orders by similarity (highest first)
    // 5. Limits results
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

    const searchElapsed = Date.now() - searchStartTime;
    console.log(
      `✅ [SEMANTIC SEARCH] Found ${(results as any[]).length} results in ${searchElapsed}ms`
    );

    // Map database results to SemanticSearchResult type
    const searchResults: SemanticSearchResult[] = (results as any[]).map((row: any) => ({
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      role: row.role as "user" | "assistant" | "system",
      content: row.content,
      similarity: parseFloat(row.similarity) || 0,
      tokens_used: row.tokens_used || 0,
      model: row.model || "unknown",
      createdAt: row.createdAt || new Date(),
    }));

    return {
      query: query.trim(),
      results: searchResults,
      count: searchResults.length,
    };
  };

  return await cacheAside(cacheKey, performSearch, CACHE_TTL.SEMANTIC_SEARCH);
}

/**
 * Get semantically relevant messages for context building
 * Used to enhance AI context with relevant older messages
 *
 * @param conversationId - Conversation ID
 * @param currentMessageContent - Current user message content
 * @param limit - Number of relevant messages to retrieve (default: 5)
 * @returns Promise with array of relevant messages
 */
export async function getRelevantMessagesForContext(
  conversationId: string,
  currentMessageContent: string,
  limit: number = 5
): Promise<SemanticSearchResult[]> {
  try {
    // Generate embedding for current message
    const queryEmbedding = await generateEmbedding(currentMessageContent);
    const vectorString = `[${queryEmbedding.join(",")}]`;

    // Find similar messages with lower threshold (0.6) to get more context
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
        AND (1 - (e.embedding <=> $1::vector)) >= 0.6
      ORDER BY e.embedding <=> $1::vector ASC
      LIMIT $3
      `,
      {
        bind: [vectorString, conversationId, limit],
        type: QueryTypes.SELECT,
      }
    );

    return (results as any[]).map((row: any) => ({
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      role: row.role as "user" | "assistant" | "system",
      content: row.content,
      similarity: parseFloat(row.similarity) || 0,
      tokens_used: row.tokens_used || 0,
      model: row.model || "unknown",
      createdAt: row.createdAt || new Date(),
    }));
  } catch {
    // If semantic search fails, return empty array
    // This ensures the app continues to work even if embeddings aren't available
    // logging removed
    return [];
  }
}

/**
 * Backfill embeddings for existing messages in a conversation
 * Useful for enabling semantic search on old conversations
 *
 * @param conversationId - Conversation ID
 * @returns Promise with number of embeddings created
 */
export async function backfillConversationEmbeddings(conversationId: string): Promise<number> {
  // Get all messages without embeddings
  const messages = await Message.findAll({
    where: { conversation_id: conversationId },
    include: [
      {
        model: MessageEmbedding,
        as: "embedding",
        required: false, // LEFT JOIN to find messages without embeddings
      },
    ],
  });

  // Filter messages that don't have embeddings
  const messagesWithoutEmbeddings = messages.filter((msg: any) => !msg.embedding);

  if (messagesWithoutEmbeddings.length === 0) {
    return 0;
  }

  // Generate embeddings
  const { batchGenerateEmbeddings } = await import("./embedding.service.js");
  const embeddings = await batchGenerateEmbeddings(
    messagesWithoutEmbeddings.map((msg) => ({
      messageId: msg.id,
      content: msg.content,
    }))
  );

  return embeddings.length;
}

export default {
  searchConversationByEmbedding,
  getRelevantMessagesForContext,
  backfillConversationEmbeddings,
};
