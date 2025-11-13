import sequelize from "../db/database.config.js";
import { QueryTypes } from "sequelize";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { generateEmbedding } from "./embedding.service.js";
import User from "../models/user.model.js";
export async function searchAllConversations(userIdOrEmail, searchParams) {
    const { query, tags, limit = 10, messagesPerConversation = 3, similarity_threshold = 0.37, } = searchParams;
    let userId = userIdOrEmail;
    if (userIdOrEmail && userIdOrEmail.includes && userIdOrEmail.includes("@")) {
        const userRecord = await User.findOne({ where: { email: userIdOrEmail } });
        if (!userRecord) {
            throw new Error("User not found");
        }
        userId = userRecord.id;
    }
    if (!query || query.trim().length === 0) {
        throw new Error("Search query cannot be empty");
    }
    const queryEmbedding = await generateEmbedding(query.trim());
    const vectorString = `[${queryEmbedding.join(",")}]`;
    let results;
    if (tags && tags.length > 0) {
        const allUserConversations = await sequelize.query(`
      SELECT id, title, tags 
      FROM conversations 
      WHERE user_id = $1 
        AND deleted_at IS NULL 
        AND project_id IS NULL
      ORDER BY "updatedAt" DESC
      LIMIT 20
      `, {
            bind: [userId],
            type: QueryTypes.SELECT,
        });
        const tagFilterCheck = await sequelize.query(`
      SELECT id, title, tags 
      FROM conversations 
      WHERE user_id = $1 
        AND deleted_at IS NULL 
        AND project_id IS NULL
        AND tags && $2::text[]
      `, {
            bind: [userId, tags],
            type: QueryTypes.SELECT,
        });
        if (tagFilterCheck.length === 0) {
            return {
                query: query.trim(),
                results: [],
                totalConversations: 0,
            };
        }
        results = await sequelize.query(`
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
      `, {
            bind: [userId, vectorString, similarity_threshold, messagesPerConversation, tags],
            type: QueryTypes.SELECT,
        });
    }
    else {
        results = await sequelize.query(`
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
      `, {
            bind: [userId, vectorString, similarity_threshold, messagesPerConversation],
            type: QueryTypes.SELECT,
        });
    }
    if (results.length === 0) {
        return {
            query: query.trim(),
            results: [],
            totalConversations: 0,
        };
    }
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
    const conversationIds = Array.from(conversationMap.keys());
    const conversations = await Conversation.findAll({
        where: {
            id: conversationIds,
        },
        attributes: ["id", "title", "updatedAt", "tags"],
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
    conversationResults.sort((a, b) => b.max_similarity - a.max_similarity);
    const limitedResults = conversationResults.slice(0, limit);
    return {
        query: query.trim(),
        results: limitedResults,
        totalConversations: conversationResults.length,
    };
}
export async function searchWithinConversation(conversationId, userIdOrEmail, searchParams) {
    const { query, limit = 5, contextMessages = 2, similarity_threshold = 0.37 } = searchParams;
    let userId = userIdOrEmail;
    if (userIdOrEmail && userIdOrEmail.includes && userIdOrEmail.includes("@")) {
        const userRecord = await User.findOne({ where: { email: userIdOrEmail } });
        if (!userRecord) {
            throw new Error("User not found");
        }
        userId = userRecord.id;
    }
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
    const queryEmbedding = await generateEmbedding(query.trim());
    const vectorString = `[${queryEmbedding.join(",")}]`;
    const statsQuery = await sequelize.query(`
    SELECT 
      COUNT(DISTINCT m.id) as total_messages,
      COUNT(DISTINCT e.message_id) as messages_with_embeddings
    FROM messages m
    LEFT JOIN message_embeddings e ON m.id = e.message_id
    WHERE m.conversation_id = $1
    `, {
        bind: [conversationId],
        type: QueryTypes.SELECT,
    });
    const results = await sequelize.query(`
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
    `, {
        bind: [vectorString, conversationId, similarity_threshold, limit],
        type: QueryTypes.SELECT,
    });
    if (results.length === 0 &&
        statsQuery[0] &&
        statsQuery[0].messages_with_embeddings > 0) {
        const topMatches = await sequelize.query(`
      SELECT 
        m.id as message_id,
        m.content,
        (1 - (e.embedding <=> $1::vector)) as similarity
      FROM messages m
      INNER JOIN message_embeddings e ON m.id = e.message_id
      WHERE m.conversation_id = $2
      ORDER BY e.embedding <=> $1::vector ASC
      LIMIT $3
      `, {
            bind: [vectorString, conversationId, limit],
            type: QueryTypes.SELECT,
        });
    }
    if (results.length === 0) {
        const textQuery = `%${query.trim()}%`;
        const textMatches = await sequelize.query(`
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
      `, {
            bind: [conversationId, textQuery, limit],
            type: QueryTypes.SELECT,
        });
        if (textMatches.length > 0) {
            const prepared = textMatches.map((r) => ({
                ...r,
                similarity: 0,
            }));
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
    const allMessages = await Message.findAll({
        where: { conversation_id: conversationId },
        order: [["createdAt", "ASC"]],
        attributes: ["id", "role", "content", "tokens_used", "model", "createdAt", "conversation_id"],
    });
    const resultsWithContext = matches.map((match) => {
        const messageIndex = allMessages.findIndex((m) => m.id === match.message_id);
        const contextBefore = [];
        for (let i = Math.max(0, messageIndex - contextMessages); i < messageIndex; i++) {
            const msg = allMessages[i];
            contextBefore.push({
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
        const contextAfter = [];
        for (let i = messageIndex + 1; i < Math.min(allMessages.length, messageIndex + contextMessages + 1); i++) {
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
