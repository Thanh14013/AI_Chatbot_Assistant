/**
 * New Chat Suggestions Service
 * Manages cached follow-up suggestions for new chat screen
 * - Stores 3 suggestions in Redis per user
 * - Only regenerates when user clicks "+ New Chat" button
 * - Fast retrieval on app start/login/dashboard access
 */
import redisClient from "../config/redis.config.js";
import { generateConversationFollowups } from "./followup.service.js";
import { getConversationMessages } from "./message.service.js";
import { getUserConversations } from "./conversation.service.js";
/**
 * Cache TTL for new chat suggestions (7 days)
 */
const SUGGESTIONS_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
/**
 * Default suggestions for brand new users (no conversation history)
 * These are shown instantly without calling AI API
 */
const DEFAULT_NEW_USER_SUGGESTIONS = [
    "Giúp tôi debug lỗi trong code JavaScript này",
    "Giải thích khái niệm async/await trong JavaScript một cách đơn giản",
    "Tạo một kế hoạch học tập để thành thạo React trong 3 tháng",
];
/**
 * Generate cache key for user's new chat suggestions
 */
const getCacheKey = (userId) => {
    return `user:${userId}:new_chat_suggestions`;
};
/**
 * Get cached new chat suggestions for a user
 * Returns null if not cached or expired
 */
export const getCachedSuggestions = async (userId) => {
    try {
        const key = getCacheKey(userId);
        const cached = await redisClient.get(key);
        if (!cached) {
            return null;
        }
        const suggestions = JSON.parse(cached);
        // Validate cached data
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
            return null;
        }
        return suggestions;
    }
    catch (error) {
        return null;
    }
};
/**
 * Set cached new chat suggestions for a user
 */
export const setCachedSuggestions = async (userId, suggestions) => {
    try {
        const key = getCacheKey(userId);
        await redisClient.setex(key, SUGGESTIONS_TTL, JSON.stringify(suggestions));
    }
    catch (error) {
        // Don't throw - fail gracefully
    }
};
/**
 * Clear cached suggestions for a user
 */
export const clearCachedSuggestions = async (userId) => {
    try {
        const key = getCacheKey(userId);
        await redisClient.del(key);
    }
    catch (error) {
        // Silent fail
    }
};
/**
 * Generate and cache new chat suggestions for a user
 * Uses recent conversation history to generate contextual suggestions
 */
export const generateAndCacheSuggestions = async (userId) => {
    try {
        // Get user's recent ACTIVE conversations only (not deleted)
        const conversationsResult = await getUserConversations(userId, 1, 10);
        const recentMessages = [];
        const validConversations = [];
        // Filter out deleted conversations and fetch messages
        for (const conv of conversationsResult.conversations) {
            // ⚡ Performance: Early exit if we already have enough messages
            if (recentMessages.length >= 20) {
                break;
            }
            // Skip if conversation is deleted
            if (conv.deleted_at) {
                continue;
            }
            try {
                // Try to fetch messages from this conversation
                // IMPORTANT: getConversationMessages expects (conversationId, userId, page, limit)
                const messagesResult = await getConversationMessages(conv.id, userId, 1, 5);
                // Only add if we got valid messages
                if (messagesResult.messages && messagesResult.messages.length > 0) {
                    validConversations.push(conv.id);
                    messagesResult.messages.forEach((msg) => {
                        if ((msg.role === "user" || msg.role === "assistant") && msg.content) {
                            recentMessages.push({
                                role: msg.role,
                                content: msg.content.substring(0, 500), // Limit content length
                            });
                        }
                    });
                }
            }
            catch (err) {
                // Skip this conversation silently if error
                continue;
            }
        }
        // If no recent messages, use generic context
        const contextMessages = recentMessages.length > 0
            ? recentMessages.slice(-20) // Use last 20 messages
            : [
                {
                    role: "assistant",
                    content: "Xin chào! Tôi là trợ lý AI của bạn. Tôi có thể giúp bạn với nhiều chủ đề khác nhau.",
                },
            ];
        // Generate suggestions using existing followup service
        const suggestions = await generateConversationFollowups(contextMessages);
        // Validate suggestions before caching
        const validSuggestions = Array.isArray(suggestions) && suggestions.length > 0
            ? suggestions.filter((s) => s && s.trim().length > 0)
            : null;
        if (!validSuggestions || validSuggestions.length === 0) {
            throw new Error("No valid suggestions generated");
        }
        // Cache the suggestions
        await setCachedSuggestions(userId, validSuggestions);
        return validSuggestions;
    }
    catch (error) {
        // Return default suggestions on error (same as new users)
        // Try to cache defaults
        try {
            await setCachedSuggestions(userId, DEFAULT_NEW_USER_SUGGESTIONS);
        }
        catch { }
        return DEFAULT_NEW_USER_SUGGESTIONS;
    }
};
/**
 * Get new chat suggestions for a user
 * Returns cached suggestions if available, otherwise generates and caches new ones
 * ⚡ OPTIMIZED: Returns instant default suggestions for brand new users
 */
export const getNewChatSuggestions = async (userId, forceRegenerate = false) => {
    // ⚡ NEW USER OPTIMIZATION: Check if user has any conversations
    // If not, return instant defaults without calling AI
    if (!forceRegenerate) {
        try {
            const conversationsResult = await getUserConversations(userId, 1, 1);
            const isNewUser = conversationsResult.conversations.length === 0;
            if (isNewUser) {
                // Cache defaults for consistency
                try {
                    await setCachedSuggestions(userId, DEFAULT_NEW_USER_SUGGESTIONS);
                }
                catch (cacheErr) {
                    // Silent fail
                }
                return DEFAULT_NEW_USER_SUGGESTIONS;
            }
        }
        catch (err) {
            // Continue to normal flow
        }
    }
    // If force regenerate, skip cache and generate new
    if (forceRegenerate) {
        return generateAndCacheSuggestions(userId);
    }
    // Try to get from cache first
    const cached = await getCachedSuggestions(userId);
    if (cached) {
        return cached;
    }
    // Cache miss - DO NOT auto-generate here. Generation should only occur when
    // the user explicitly requests it (forceRegenerate = true), e.g. by clicking
    // the "+ New Chat" button. This prevents unexpected AI calls on mount.
    // Return empty list to indicate no cached suggestions available. The client
    // will show defaults for brand-new users (handled above) or an empty state
    // and can trigger generation when the user clicks the New Chat button.
    return [];
};
