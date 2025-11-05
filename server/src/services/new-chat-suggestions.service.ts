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
 * Generate cache key for user's new chat suggestions
 */
const getCacheKey = (userId: string): string => {
  return `user:${userId}:new_chat_suggestions`;
};

/**
 * Get cached new chat suggestions for a user
 * Returns null if not cached or expired
 */
export const getCachedSuggestions = async (userId: string): Promise<string[] | null> => {
  try {
    const key = getCacheKey(userId);
    console.log(`[NewChatSuggestions] Getting cached suggestions for user ${userId}`);
    const cached = await redisClient.get(key);

    if (!cached) {
      console.log(`[NewChatSuggestions] No cached suggestions found for user ${userId}`);
      return null;
    }

    const suggestions = JSON.parse(cached);

    // Validate cached data
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      console.log(`[NewChatSuggestions] Invalid cached data for user ${userId}`);
      return null;
    }

    console.log(
      `[NewChatSuggestions] Found ${suggestions.length} cached suggestions for user ${userId}`
    );
    return suggestions;
  } catch (error) {
    console.error("[NewChatSuggestions] Error getting cached suggestions:", error);
    return null;
  }
};

/**
 * Set cached new chat suggestions for a user
 */
export const setCachedSuggestions = async (
  userId: string,
  suggestions: string[]
): Promise<void> => {
  try {
    const key = getCacheKey(userId);
    await redisClient.setex(key, SUGGESTIONS_TTL, JSON.stringify(suggestions));
    console.log(
      `[NewChatSuggestions] Cached ${suggestions.length} suggestions for user ${userId} (TTL: ${SUGGESTIONS_TTL}s)`
    );
  } catch (error) {
    console.error("[NewChatSuggestions] Error setting cached suggestions:", error);
    // Don't throw - fail gracefully
  }
};

/**
 * Clear cached suggestions for a user
 */
export const clearCachedSuggestions = async (userId: string): Promise<void> => {
  try {
    const key = getCacheKey(userId);
    await redisClient.del(key);
  } catch (error) {
    console.error("[NewChatSuggestions] Error clearing cached suggestions:", error);
  }
};

/**
 * Generate and cache new chat suggestions for a user
 * Uses recent conversation history to generate contextual suggestions
 */
export const generateAndCacheSuggestions = async (userId: string): Promise<string[]> => {
  try {
    // Get user's recent ACTIVE conversations only (not deleted)
    const conversationsResult = await getUserConversations(userId, 1, 10);

    const recentMessages: Array<{ role: string; content: string }> = [];
    const validConversations: string[] = [];

    // Filter out deleted conversations and fetch messages
    for (const conv of conversationsResult.conversations) {
      // Skip if conversation is deleted
      if (conv.deleted_at) {
        console.log(`[NewChatSuggestions] Skipping deleted conversation ${conv.id}`);
        continue;
      }

      try {
        // Try to fetch messages from this conversation
        // IMPORTANT: getConversationMessages expects (conversationId, userId, page, limit)
        const messagesResult = await getConversationMessages(conv.id, userId, 1, 5);

        // Only add if we got valid messages
        if (messagesResult.messages && messagesResult.messages.length > 0) {
          validConversations.push(conv.id);

          messagesResult.messages.forEach((msg: any) => {
            if ((msg.role === "user" || msg.role === "assistant") && msg.content) {
              recentMessages.push({
                role: msg.role,
                content: msg.content.substring(0, 500), // Limit content length
              });
            }
          });
        }
      } catch (err: any) {
        // Skip this conversation silently if error
        console.log(
          `[NewChatSuggestions] Skipping conversation ${conv.id}: ${err.message || "Error"}`
        );
        continue;
      }

      // Stop if we have enough context (20 messages from valid conversations)
      if (recentMessages.length >= 20) break;
    }

    console.log(
      `[NewChatSuggestions] Collected ${recentMessages.length} messages from ${validConversations.length} valid conversations`
    );

    // If no recent messages, use generic context
    const contextMessages =
      recentMessages.length > 0
        ? recentMessages.slice(-20) // Use last 20 messages
        : [
            {
              role: "assistant",
              content:
                "Xin chào! Tôi là trợ lý AI của bạn. Tôi có thể giúp bạn với nhiều chủ đề khác nhau.",
            },
          ];

    // Generate suggestions using existing followup service
    const suggestions = await generateConversationFollowups(contextMessages);

    // Validate suggestions before caching
    const validSuggestions =
      Array.isArray(suggestions) && suggestions.length > 0
        ? suggestions.filter((s) => s && s.trim().length > 0)
        : null;

    if (!validSuggestions || validSuggestions.length === 0) {
      throw new Error("No valid suggestions generated");
    }

    // Cache the suggestions
    await setCachedSuggestions(userId, validSuggestions);

    console.log(
      `[NewChatSuggestions] Generated ${validSuggestions.length} suggestions based on ${recentMessages.length} recent messages`
    );

    return validSuggestions;
  } catch (error) {
    console.error("[NewChatSuggestions] Error generating suggestions:", error);

    // Return default Vietnamese suggestions on error
    const defaultSuggestions = [
      "Tôi nên bắt đầu hỏi bạn về điều gì để giải quyết vấn đề hôm nay?",
      "Bạn có thể cho tôi một gợi ý nhanh về những gì bạn có thể làm ngay bây giờ không?",
      "Tôi muốn biết phạm vi trợ giúp của bạn, bạn có thể liệt kê những gì bạn có thể giúp tôi được không?",
    ];

    // Try to cache defaults
    try {
      await setCachedSuggestions(userId, defaultSuggestions);
    } catch {}

    return defaultSuggestions;
  }
};

/**
 * Get new chat suggestions for a user
 * Returns cached suggestions if available, otherwise generates and caches new ones
 */
export const getNewChatSuggestions = async (
  userId: string,
  forceRegenerate = false
): Promise<string[]> => {
  console.log(
    `[NewChatSuggestions] Getting suggestions for user ${userId}, forceRegenerate: ${forceRegenerate}`
  );

  // If force regenerate, skip cache and generate new
  if (forceRegenerate) {
    console.log(`[NewChatSuggestions] Force regenerating suggestions for user ${userId}`);
    return generateAndCacheSuggestions(userId);
  }

  // Try to get from cache first
  const cached = await getCachedSuggestions(userId);
  if (cached) {
    console.log(`[NewChatSuggestions] Returning cached suggestions for user ${userId}`);
    return cached;
  }

  // Cache miss - generate and cache
  console.log(`[NewChatSuggestions] Cache miss, generating new suggestions for user ${userId}`);
  return generateAndCacheSuggestions(userId);
};
