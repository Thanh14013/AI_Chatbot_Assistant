import redisClient from "../config/redis.config.js";
import { generateConversationFollowups } from "./followup.service.js";
import { getConversationMessages } from "./message.service.js";
import { getUserConversations } from "./conversation.service.js";
const SUGGESTIONS_TTL = 7 * 24 * 60 * 60;
const DEFAULT_NEW_USER_SUGGESTIONS = [
    "Giúp tôi debug lỗi trong code JavaScript này",
    "Giải thích khái niệm async/await trong JavaScript một cách đơn giản",
    "Tạo một kế hoạch học tập để thành thạo React trong 3 tháng",
];
const getCacheKey = (userId) => {
    return `user:${userId}:new_chat_suggestions`;
};
export const getCachedSuggestions = async (userId) => {
    try {
        const key = getCacheKey(userId);
        const cached = await redisClient.get(key);
        if (!cached) {
            return null;
        }
        const suggestions = JSON.parse(cached);
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
            return null;
        }
        return suggestions;
    }
    catch (error) {
        return null;
    }
};
export const setCachedSuggestions = async (userId, suggestions) => {
    try {
        const key = getCacheKey(userId);
        await redisClient.setex(key, SUGGESTIONS_TTL, JSON.stringify(suggestions));
    }
    catch (error) {
    }
};
export const clearCachedSuggestions = async (userId) => {
    try {
        const key = getCacheKey(userId);
        await redisClient.del(key);
    }
    catch (error) {
    }
};
export const generateAndCacheSuggestions = async (userId) => {
    try {
        const conversationsResult = await getUserConversations(userId, 1, 10);
        const recentMessages = [];
        const validConversations = [];
        for (const conv of conversationsResult.conversations) {
            if (recentMessages.length >= 20) {
                break;
            }
            if (conv.deleted_at) {
                continue;
            }
            try {
                const messagesResult = await getConversationMessages(conv.id, userId, 1, 5);
                if (messagesResult.messages && messagesResult.messages.length > 0) {
                    validConversations.push(conv.id);
                    messagesResult.messages.forEach((msg) => {
                        if ((msg.role === "user" || msg.role === "assistant") && msg.content) {
                            recentMessages.push({
                                role: msg.role,
                                content: msg.content.substring(0, 500),
                            });
                        }
                    });
                }
            }
            catch (err) {
                continue;
            }
        }
        const contextMessages = recentMessages.length > 0
            ? recentMessages.slice(-20)
            : [
                {
                    role: "assistant",
                    content: "Xin chào! Tôi là trợ lý AI của bạn. Tôi có thể giúp bạn với nhiều chủ đề khác nhau.",
                },
            ];
        const suggestions = await generateConversationFollowups(contextMessages);
        const validSuggestions = Array.isArray(suggestions) && suggestions.length > 0
            ? suggestions.filter((s) => s && s.trim().length > 0)
            : null;
        if (!validSuggestions || validSuggestions.length === 0) {
            throw new Error("No valid suggestions generated");
        }
        await setCachedSuggestions(userId, validSuggestions);
        return validSuggestions;
    }
    catch (error) {
        try {
            await setCachedSuggestions(userId, DEFAULT_NEW_USER_SUGGESTIONS);
        }
        catch { }
        return DEFAULT_NEW_USER_SUGGESTIONS;
    }
};
export const getNewChatSuggestions = async (userId, forceRegenerate = false) => {
    if (!forceRegenerate) {
        try {
            const conversationsResult = await getUserConversations(userId, 1, 1);
            const isNewUser = conversationsResult.conversations.length === 0;
            if (isNewUser) {
                try {
                    await setCachedSuggestions(userId, DEFAULT_NEW_USER_SUGGESTIONS);
                }
                catch (cacheErr) {
                }
                return DEFAULT_NEW_USER_SUGGESTIONS;
            }
        }
        catch (err) {
        }
    }
    if (forceRegenerate) {
        return generateAndCacheSuggestions(userId);
    }
    const cached = await getCachedSuggestions(userId);
    if (cached) {
        return cached;
    }
    return [];
};
