import crypto from "crypto";

/**
 * Cache Key Generator Utility
 * Generates consistent cache keys for different data types
 */

/**
 * Generate cache key for user by email
 */
export function userByEmailKey(email: string): string {
  return `user:email:${email.toLowerCase()}`;
}

/**
 * Generate cache key for user by ID
 */
export function userByIdKey(userId: string): string {
  return `user:id:${userId}`;
}

/**
 * Generate cache key for conversation list
 */
export function conversationListKey(
  userId: string,
  page: number = 1,
  limit: number = 20,
  search?: string
): string {
  const searchPart = search ? `:search:${search}` : "";
  return `conversations:user:${userId}:page:${page}:limit:${limit}${searchPart}`;
}

/**
 * Generate pattern to invalidate all conversation lists for a user
 */
export function conversationListPattern(userId: string): string {
  return `conversations:user:${userId}:*`;
}

/**
 * Generate cache key for message history
 */
export function messageHistoryKey(
  conversationId: string,
  page: number = 1,
  limit: number = 30,
  before?: string
): string {
  const beforePart = before ? `:before:${before}` : "";
  return `messages:conv:${conversationId}:page:${page}:limit:${limit}${beforePart}`;
}

/**
 * Generate pattern to invalidate all message history for a conversation
 */
export function messageHistoryPattern(conversationId: string): string {
  return `messages:conv:${conversationId}:*`;
}

/**
 * Generate cache key for recent messages (context)
 */
export function recentMessagesKey(conversationId: string, limit: number): string {
  return `context:conv:${conversationId}:recent:${limit}`;
}

/**
 * Generate pattern to invalidate context cache for a conversation
 */
export function contextPattern(conversationId: string): string {
  return `context:conv:${conversationId}:*`;
}

/**
 * Generate cache key for semantic search
 * Uses hash of query to keep key size manageable
 */
export function semanticSearchKey(
  conversationId: string,
  query: string,
  limit: number = 5,
  threshold: number = 0.37
): string {
  // Create hash of query to keep key size reasonable
  const queryHash = crypto.createHash("md5").update(query.toLowerCase().trim()).digest("hex");
  return `search:semantic:${conversationId}:${queryHash}:limit:${limit}:threshold:${threshold}`;
}

/**
 * Generate pattern to invalidate all semantic searches for a conversation
 */
export function semanticSearchPattern(conversationId: string): string {
  return `search:semantic:${conversationId}:*`;
}

/**
 * Generate cache key for refresh token validation
 */
export function refreshTokenKey(token: string): string {
  // Use hash to avoid storing full token in key
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return `token:refresh:${tokenHash}`;
}

/**
 * Generate cache key for conversation metadata
 */
export function conversationMetaKey(conversationId: string): string {
  return `conversation:meta:${conversationId}`;
}

/**
 * Generate pattern to invalidate all conversation metadata
 */
export function conversationMetaPattern(conversationId: string): string {
  return `conversation:meta:${conversationId}`;
}

/**
 * Generate cache key for global search results
 */
export function globalSearchKey(userId: string, query: string, page: number = 1): string {
  const queryHash = crypto.createHash("md5").update(query.toLowerCase().trim()).digest("hex");
  return `search:global:user:${userId}:${queryHash}:page:${page}`;
}

/**
 * Generate pattern to invalidate all searches for a user
 */
export function globalSearchPattern(userId: string): string {
  return `search:global:user:${userId}:*`;
}

/**
 * Generate cache key for popular tags for a user
 */
export function popularTagsKey(userId: string): string {
  return `tags:popular:user:${userId}`;
}

/**
 * Generate cache key for project list for a user
 */
export function projectListKey(userId: string): string {
  return `projects:user:${userId}`;
}

/**
 * Generate pattern to invalidate all project lists for a user
 */
export function projectListPattern(userId: string): string {
  return `projects:user:${userId}:*`;
}

export default {
  userByEmailKey,
  userByIdKey,
  conversationListKey,
  conversationListPattern,
  messageHistoryKey,
  messageHistoryPattern,
  recentMessagesKey,
  contextPattern,
  semanticSearchKey,
  semanticSearchPattern,
  refreshTokenKey,
  conversationMetaKey,
  conversationMetaPattern,
  globalSearchKey,
  globalSearchPattern,
  popularTagsKey,
  projectListKey,
  projectListPattern,
};
