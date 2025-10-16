import sequelize from "../db/database.config.js";
import { QueryTypes } from "sequelize";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { generateEmbedding } from "./embedding.service.js";
/**
 * Search across all user's conversations
 * Groups results by conversation and returns top conversations
 *
 * @param userId - User ID to search within
 * @param searchParams - Search parameters
 * @returns Promise with grouped search results
 */
export async function searchAllConversations(userId, searchParams) {
  const {
    query,
    limit = 10,
    messagesPerConversation = 3,
    similarity_threshold = 0.37,
  } = searchParams;
  // Validate input
  if (!query || query.trim().length === 0) {
    throw new Error("Search query cannot be empty");
  }
  // Generate embedding for search query
  const queryEmbedding = await generateEmbedding(query.trim());
  const vectorString = `[${queryEmbedding.join(",")}]`;
  // Step 1: Find all matching messages across user's conversations
  // Group by conversation and get top messages per conversation
  const results = await sequelize.query(
    `
    WITH user_conversations AS (
      SELECT id FROM conversations 
      WHERE user_id = $1 AND deleted_at IS NULL
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
  // Step 2: Group results by conversation
  const conversationMap = new Map();
  for (const row of results) {
    const conversationId = row.conversation_id;
    const message = {
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      role: row.role,
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
    const convData = conversationMap.get(conversationId);
    convData.messages.push(message);
    convData.maxSimilarity = Math.max(convData.maxSimilarity, message.similarity);
  }
  // Step 3: Get conversation details and sort by max similarity
  const conversationIds = Array.from(conversationMap.keys());
  const conversations = await Conversation.findAll({
    where: {
      id: conversationIds,
    },
    attributes: ["id", "title", "updatedAt"],
  });
  const conversationResults = conversations.map((conv) => {
    const data = conversationMap.get(conv.id);
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
export async function searchWithinConversation(conversationId, userId, searchParams) {
  const { query, limit = 5, contextMessages = 2, similarity_threshold = 0.37 } = searchParams;
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
  const matches = results.map((row) => ({
    message_id: row.message_id,
    conversation_id: row.conversation_id,
    role: row.role,
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
    const contextBefore = [];
    for (let i = Math.max(0, messageIndex - contextMessages); i < messageIndex; i++) {
      const msg = allMessages[i];
      contextBefore.push({
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.role,
        content: msg.content,
        similarity: 0, // Context messages don't have similarity scores
        tokens_used: msg.tokens_used,
        model: msg.model,
        createdAt: msg.createdAt,
      });
    }
    // Get context after
    const contextAfter = [];
    for (
      let i = messageIndex + 1;
      i < Math.min(allMessages.length, messageIndex + contextMessages + 1);
      i++
    ) {
      const msg = allMessages[i];
      contextAfter.push({
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.role,
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
