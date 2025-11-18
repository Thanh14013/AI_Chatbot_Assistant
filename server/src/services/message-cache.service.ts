/**
 * Message Cache Service - Redis Sorted Set for Recent Messages
 * Optimizes message loading with O(1) lookups using Redis Sorted Sets
 */

import redisClient, { isRedisConnected } from "../config/redis.config.js";
import type { MessageResponse } from "../types/message.type.js";

const RECENT_MESSAGES_LIMIT = 100; // Cache last 100 messages per conversation
const CACHE_TTL = 3600; // 1 hour TTL

/**
 * Redis key for recent messages sorted set
 */
const recentMessagesKey = (conversationId: string) => `messages:recent:${conversationId}`;

/**
 * Get recent messages from Redis cache (Sorted Set)
 * Returns messages in chronological order (oldest first)
 */
export async function getCachedRecentMessages(
  conversationId: string,
  limit: number = 50
): Promise<MessageResponse[] | null> {
  if (!isRedisConnected()) return null;

  try {
    const key = recentMessagesKey(conversationId);

    // Get last N messages from sorted set (by score = timestamp)
    // ZREVRANGE returns newest first, so we get top N
    const messageStrings = await redisClient.zrevrange(key, 0, limit - 1);

    if (!messageStrings || messageStrings.length === 0) return null;

    // Parse messages and reverse to get chronological order
    const messages = messageStrings
      .map((str) => {
        try {
          return JSON.parse(str) as MessageResponse;
        } catch {
          return null;
        }
      })
      .filter((msg): msg is MessageResponse => msg !== null)
      .reverse(); // Oldest first

    return messages;
  } catch (error) {
    console.error("[MessageCache] Failed to get cached messages:", error);
    return null;
  }
}

/**
 * Cache recent messages in Redis Sorted Set
 * Score = createdAt timestamp for efficient range queries
 */
export async function cacheRecentMessages(
  conversationId: string,
  messages: MessageResponse[]
): Promise<void> {
  if (!isRedisConnected() || messages.length === 0) return;

  try {
    const key = recentMessagesKey(conversationId);

    // Prepare ZADD arguments: score, member pairs
    const pipeline = redisClient.pipeline();

    // Delete old cache first
    pipeline.del(key);

    // Add messages to sorted set with timestamp as score
    for (const msg of messages) {
      const score = new Date(msg.createdAt).getTime();
      const member = JSON.stringify(msg);
      pipeline.zadd(key, score, member);
    }

    // Keep only last N messages (trim older ones)
    pipeline.zremrangebyrank(key, 0, -(RECENT_MESSAGES_LIMIT + 1));

    // Set TTL
    pipeline.expire(key, CACHE_TTL);

    await pipeline.exec();
  } catch (error) {
    console.error("[MessageCache] Failed to cache messages:", error);
  }
}

/**
 * Add a single message to cache (for real-time updates)
 */
export async function addMessageToCache(
  conversationId: string,
  message: MessageResponse
): Promise<void> {
  if (!isRedisConnected()) return;

  try {
    const key = recentMessagesKey(conversationId);
    const score = new Date(message.createdAt).getTime();
    const member = JSON.stringify(message);

    const pipeline = redisClient.pipeline();
    pipeline.zadd(key, score, member);
    // Keep only last N messages
    pipeline.zremrangebyrank(key, 0, -(RECENT_MESSAGES_LIMIT + 1));
    pipeline.expire(key, CACHE_TTL);

    await pipeline.exec();
  } catch (error) {
    console.error("[MessageCache] Failed to add message to cache:", error);
  }
}

/**
 * Invalidate message cache for a conversation
 */
export async function invalidateMessageCache(conversationId: string): Promise<void> {
  if (!isRedisConnected()) return;

  try {
    const key = recentMessagesKey(conversationId);
    await redisClient.del(key);
  } catch (error) {
    console.error("[MessageCache] Failed to invalidate cache:", error);
  }
}

/**
 * Update a message in cache (for pin/unpin, edits)
 */
export async function updateMessageInCache(
  conversationId: string,
  messageId: string,
  updates: Partial<MessageResponse>
): Promise<void> {
  if (!isRedisConnected()) return;

  try {
    const key = recentMessagesKey(conversationId);

    // Get all messages
    const messageStrings = await redisClient.zrange(key, 0, -1);
    if (!messageStrings || messageStrings.length === 0) return;

    // Find and update the message
    const pipeline = redisClient.pipeline();
    let found = false;

    for (const msgStr of messageStrings) {
      try {
        const msg = JSON.parse(msgStr) as MessageResponse;
        if (msg.id === messageId) {
          // Remove old version
          pipeline.zrem(key, msgStr);
          // Add updated version
          const updatedMsg = { ...msg, ...updates };
          const score = new Date(updatedMsg.createdAt).getTime();
          pipeline.zadd(key, score, JSON.stringify(updatedMsg));
          found = true;
          break;
        }
      } catch {}
    }

    if (found) {
      pipeline.expire(key, CACHE_TTL);
      await pipeline.exec();
    }
  } catch (error) {
    console.error("[MessageCache] Failed to update message in cache:", error);
  }
}

export default {
  getCachedRecentMessages,
  cacheRecentMessages,
  addMessageToCache,
  invalidateMessageCache,
  updateMessageInCache,
};
