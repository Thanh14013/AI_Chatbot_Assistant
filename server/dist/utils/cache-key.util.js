import crypto from "crypto";
/**
 * Cache Key Generator Utility
 * Generates consistent cache keys for different data types
 */
/**
 * Generate cache key for user by email
 */
export function userByEmailKey(email) {
    return `user:email:${email.toLowerCase()}`;
}
/**
 * Generate cache key for user by ID
 */
export function userByIdKey(userId) {
    return `user:id:${userId}`;
}
/**
 * Generate cache key for conversation list
 */
export function conversationListKey(userId, page = 1, limit = 20, search) {
    const searchPart = search ? `:search:${search}` : "";
    return `conversations:user:${userId}:page:${page}:limit:${limit}${searchPart}`;
}
/**
 * Generate pattern to invalidate all conversation lists for a user
 */
export function conversationListPattern(userId) {
    return `conversations:user:${userId}:*`;
}
/**
 * Generate cache key for message history
 */
export function messageHistoryKey(conversationId, page = 1, limit = 30, before) {
    const beforePart = before ? `:before:${before}` : "";
    return `messages:conv:${conversationId}:page:${page}:limit:${limit}${beforePart}`;
}
/**
 * Generate pattern to invalidate all message history for a conversation
 */
export function messageHistoryPattern(conversationId) {
    return `messages:conv:${conversationId}:*`;
}
/**
 * Generate cache key for recent messages (context)
 */
export function recentMessagesKey(conversationId, limit) {
    return `context:conv:${conversationId}:recent:${limit}`;
}
/**
 * Generate pattern to invalidate context cache for a conversation
 */
export function contextPattern(conversationId) {
    return `context:conv:${conversationId}:*`;
}
/**
 * Generate cache key for semantic search
 * Uses hash of query to keep key size manageable
 */
export function semanticSearchKey(conversationId, query, limit = 5, threshold = 0.37) {
    // Create hash of query to keep key size reasonable
    const queryHash = crypto.createHash("md5").update(query.toLowerCase().trim()).digest("hex");
    return `search:semantic:${conversationId}:${queryHash}:limit:${limit}:threshold:${threshold}`;
}
/**
 * Generate pattern to invalidate all semantic searches for a conversation
 */
export function semanticSearchPattern(conversationId) {
    return `search:semantic:${conversationId}:*`;
}
/**
 * Generate cache key for refresh token validation
 */
export function refreshTokenKey(token) {
    // Use hash to avoid storing full token in key
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    return `token:refresh:${tokenHash}`;
}
/**
 * Generate cache key for conversation metadata
 */
export function conversationMetaKey(conversationId) {
    return `conversation:meta:${conversationId}`;
}
/**
 * Generate pattern to invalidate all conversation metadata
 */
export function conversationMetaPattern(conversationId) {
    return `conversation:meta:${conversationId}`;
}
/**
 * Generate cache key for global search results
 */
export function globalSearchKey(userId, query, page = 1) {
    const queryHash = crypto.createHash("md5").update(query.toLowerCase().trim()).digest("hex");
    return `search:global:user:${userId}:${queryHash}:page:${page}`;
}
/**
 * Generate pattern to invalidate all searches for a user
 */
export function globalSearchPattern(userId) {
    return `search:global:user:${userId}:*`;
}
/**
 * Generate cache key for popular tags for a user
 */
export function popularTagsKey(userId) {
    return `tags:popular:user:${userId}`;
}
/**
 * Generate cache key for project list for a user
 */
export function projectListKey(userId) {
    return `projects:user:${userId}`;
}
/**
 * Generate pattern to invalidate all project lists for a user
 */
export function projectListPattern(userId) {
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
