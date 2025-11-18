import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { Op } from "sequelize";
import { cacheAside, CACHE_TTL, invalidateCachePattern, deleteCache } from "./cache.service.js";
import { conversationListKey, conversationListPattern, conversationMetaKey, popularTagsKey, projectListPattern, } from "../utils/cache-key.util.js";
import { sanitizeTags } from "../utils/tag.util.js";
import sequelize from "../db/database.config.js";
export const createConversation = async (data) => {
    if (!data.user_id || !data.title) {
        throw new Error("User ID and title are required");
    }
    const conversation = await sequelize.transaction(async (t) => {
        const existing = await Conversation.findOne({
            where: {
                user_id: data.user_id,
                title: data.title,
                deleted_at: null,
            },
            transaction: t,
            lock: true,
        });
        if (existing) {
            const timeDiff = Date.now() - new Date(existing.createdAt).getTime();
            if (timeDiff < 5000) {
                return existing;
            }
        }
        const tags = sanitizeTags(data.tags || []);
        const newConversation = await Conversation.create({
            user_id: data.user_id,
            title: data.title,
            model: data.model || "gpt-4o-mini",
            context_window: data.context_window || 10,
            total_tokens_used: 0,
            message_count: 0,
            tags,
            project_id: data.project_id || null,
            order_in_project: 0,
            deleted_at: null,
        }, { transaction: t });
        return newConversation;
    });
    await invalidateCachePattern(conversationListPattern(data.user_id));
    await deleteCache(popularTagsKey(data.user_id));
    return {
        id: conversation.id,
        user_id: conversation.user_id,
        title: conversation.title,
        model: conversation.model,
        context_window: conversation.context_window,
        total_tokens_used: conversation.total_tokens_used,
        message_count: conversation.message_count,
        tags: conversation.tags,
        project_id: conversation.project_id,
        order_in_project: conversation.order_in_project,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        deleted_at: conversation.deleted_at,
    };
};
export const getUserConversations = async (userId, page = 1, limit = 20, search, tags, tagMode = "any", standalone) => {
    const tagsStr = tags?.join(",") || "";
    const standaloneStr = standalone !== undefined ? `:standalone:${standalone}` : "";
    const cacheKey = `${conversationListKey(userId, page, limit, search)}:tags:${tagsStr}:mode:${tagMode}${standaloneStr}`;
    const fetchConversations = async () => {
        const offset = (page - 1) * limit;
        const whereClause = {
            user_id: userId,
            deleted_at: null,
        };
        if (standalone === true) {
            whereClause.project_id = null;
        }
        else if (standalone === false) {
            whereClause.project_id = {
                [Op.ne]: null,
            };
        }
        if (search && search.trim()) {
            whereClause.title = {
                [Op.iLike]: `%${search.trim()}%`,
            };
        }
        if (tags && tags.length > 0) {
            if (tagMode === "all") {
                whereClause.tags = {
                    [Op.contains]: tags,
                };
            }
            else {
                whereClause.tags = {
                    [Op.overlap]: tags,
                };
            }
        }
        const total = await Conversation.count({
            where: whereClause,
        });
        const conversations = await Conversation.findAll({
            where: whereClause,
            order: [["updatedAt", "DESC"]],
            limit,
            offset,
        });
        if (conversations[0]) {
            const firstConv = conversations[0];
        }
        const conversationResponses = conversations.map((conv) => ({
            id: conv.id,
            user_id: conv.user_id,
            title: conv.title,
            model: conv.model,
            context_window: conv.context_window,
            total_tokens_used: conv.total_tokens_used,
            message_count: conv.message_count,
            tags: conv.tags,
            project_id: conv.project_id,
            order_in_project: conv.order_in_project,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            deleted_at: conv.deleted_at,
        }));
        const totalPages = Math.ceil(total / limit);
        return {
            conversations: conversationResponses,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    };
    return await cacheAside(cacheKey, fetchConversations, CACHE_TTL.CONVERSATION_LIST);
};
export const getConversationById = async (conversationId, userId) => {
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
    return {
        id: conversation.id,
        user_id: conversation.user_id,
        title: conversation.title,
        model: conversation.model,
        context_window: conversation.context_window,
        total_tokens_used: conversation.total_tokens_used,
        message_count: conversation.message_count,
        tags: conversation.tags,
        project_id: conversation.project_id,
        order_in_project: conversation.order_in_project,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        deleted_at: conversation.deleted_at,
    };
};
export const updateConversation = async (conversationId, userId, data) => {
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
    const projectIdChanged = data.project_id !== undefined && data.project_id !== conversation.project_id;
    if (data.title !== undefined) {
        conversation.title = data.title;
    }
    if (data.model !== undefined) {
        conversation.model = data.model;
    }
    if (data.context_window !== undefined) {
        conversation.context_window = data.context_window;
    }
    if (data.tags !== undefined) {
        const sanitizedTags = sanitizeTags(data.tags);
        conversation.tags = sanitizedTags;
    }
    await conversation.save();
    await invalidateCachePattern(conversationListPattern(userId));
    await deleteCache(conversationMetaKey(conversationId));
    await deleteCache(popularTagsKey(userId));
    if (projectIdChanged) {
        await invalidateCachePattern(projectListPattern(userId));
    }
    return {
        id: conversation.id,
        user_id: conversation.user_id,
        title: conversation.title,
        model: conversation.model,
        context_window: conversation.context_window,
        total_tokens_used: conversation.total_tokens_used,
        message_count: conversation.message_count,
        tags: conversation.tags,
        project_id: conversation.project_id,
        order_in_project: conversation.order_in_project,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        deleted_at: conversation.deleted_at,
    };
};
export const deleteConversation = async (conversationId, userId) => {
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
    const belongsToProject = conversation.project_id !== null;
    conversation.deleted_at = new Date();
    await conversation.save();
    await invalidateCachePattern(conversationListPattern(userId));
    await deleteCache(conversationMetaKey(conversationId));
    if (belongsToProject) {
        await invalidateCachePattern(projectListPattern(userId));
    }
    Message.deleteByConversation(conversationId)
        .then(() => {
    })
        .catch((err) => {
    });
    return {
        message: "Conversation deleted successfully",
    };
};
export const generateConversationTitle = async (userMessage, assistantMessage) => {
    try {
        const openai = (await import("./openai.service.js")).default;
        const prompt = `Based on this conversation, generate a short, concise title (maximum 60 characters). Only return the title, nothing else.

User: ${userMessage.substring(0, 200)}
Assistant: ${assistantMessage.substring(0, 200)}

Title:`;
        const response = await openai.chat.completions.create({
<<<<<<< HEAD
            model: "gpt-4.1-mini",
=======
            model: "gpt-4o-mini",
>>>>>>> b5a25b404b0fd5beee8e603d5df07ab1ee134af5
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that creates short, concise conversation titles. Return only the title, maximum 60 characters.",
                },
                { role: "user", content: prompt },
            ],
            max_completion_tokens: 20,
        });
        const title = response.choices[0]?.message?.content?.trim() || "New Chat";
        return title.length > 60 ? title.substring(0, 57) + "..." : title;
    }
    catch (error) {
        return "New Chat";
    }
};
export const getPopularTags = async (userId) => {
    const cacheKey = popularTagsKey(userId);
    const fetchPopularTags = async () => {
        const result = await sequelize.query(`
      SELECT tag_name as name, COUNT(*) as count
      FROM conversations, unnest(tags) as tag_name
      WHERE user_id = :userId AND deleted_at IS NULL
      GROUP BY tag_name
      ORDER BY count DESC, tag_name ASC
      LIMIT 20
      `, {
            replacements: { userId },
            type: "SELECT",
        });
        return result.map((row) => ({
            name: row.name,
            count: parseInt(row.count, 10),
        }));
    };
    return await cacheAside(cacheKey, fetchPopularTags, 300);
};
