import sequelize from "../db/database.config.js";
import { QueryTypes } from "sequelize";
import Message from "../models/message.model.js";
import MessageEmbedding from "../models/message-embedding.model.js";
import Conversation from "../models/conversation.model.js";
import { generateEmbedding } from "./embedding.service.js";
import { cacheAside, CACHE_TTL } from "./cache.service.js";
import { semanticSearchKey } from "../utils/cache-key.util.js";
export async function searchConversationByEmbedding(conversationId, userId, searchParams) {
    const { query, limit = 5, similarity_threshold = 0.37 } = searchParams;
    if (!query || query.trim().length === 0) {
        throw new Error("Search query cannot be empty");
    }
    const cacheKey = semanticSearchKey(conversationId, query, limit, similarity_threshold);
    const performSearch = async () => {
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
        const searchStartTime = Date.now();
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
        const searchElapsed = Date.now() - searchStartTime;
        const searchResults = results.map((row) => ({
            message_id: row.message_id,
            conversation_id: row.conversation_id,
            role: row.role,
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
export async function getRelevantMessagesForContext(conversationId, currentMessageContent, limit = 5) {
    try {
        const queryEmbedding = await generateEmbedding(currentMessageContent);
        const vectorString = `[${queryEmbedding.join(",")}]`;
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
        AND (1 - (e.embedding <=> $1::vector)) >= 0.6
      ORDER BY e.embedding <=> $1::vector ASC
      LIMIT $3
      `, {
            bind: [vectorString, conversationId, limit],
            type: QueryTypes.SELECT,
        });
        return results.map((row) => ({
            message_id: row.message_id,
            conversation_id: row.conversation_id,
            role: row.role,
            content: row.content,
            similarity: parseFloat(row.similarity) || 0,
            tokens_used: row.tokens_used || 0,
            model: row.model || "unknown",
            createdAt: row.createdAt || new Date(),
        }));
    }
    catch {
        return [];
    }
}
export async function backfillConversationEmbeddings(conversationId) {
    const messages = await Message.findAll({
        where: { conversation_id: conversationId },
        include: [
            {
                model: MessageEmbedding,
                as: "embedding",
                required: false,
            },
        ],
    });
    const messagesWithoutEmbeddings = messages.filter((msg) => !msg.embedding);
    if (messagesWithoutEmbeddings.length === 0) {
        return 0;
    }
    const { batchGenerateEmbeddings } = await import("./embedding.service.js");
    const embeddings = await batchGenerateEmbeddings(messagesWithoutEmbeddings.map((msg) => ({
        messageId: msg.id,
        content: msg.content,
    })));
    return embeddings.length;
}
export default {
    searchConversationByEmbedding,
    getRelevantMessagesForContext,
    backfillConversationEmbeddings,
};
