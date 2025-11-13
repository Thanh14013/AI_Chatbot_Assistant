import crypto from "crypto";
export function userByEmailKey(email) {
    return `user:email:${email.toLowerCase()}`;
}
export function userByIdKey(userId) {
    return `user:id:${userId}`;
}
export function conversationListKey(userId, page = 1, limit = 20, search) {
    const searchPart = search ? `:search:${search}` : "";
    return `conversations:user:${userId}:page:${page}:limit:${limit}${searchPart}`;
}
export function conversationListPattern(userId) {
    return `conversations:user:${userId}:*`;
}
export function messageHistoryKey(conversationId, page = 1, limit = 30, before) {
    const beforePart = before ? `:before:${before}` : "";
    return `messages:conv:${conversationId}:page:${page}:limit:${limit}${beforePart}`;
}
export function messageHistoryPattern(conversationId) {
    return `messages:conv:${conversationId}:*`;
}
export function recentMessagesKey(conversationId, limit) {
    return `context:conv:${conversationId}:recent:${limit}`;
}
export function contextPattern(conversationId) {
    return `context:conv:${conversationId}:*`;
}
export function semanticSearchKey(conversationId, query, limit = 5, threshold = 0.37) {
    const queryHash = crypto.createHash("md5").update(query.toLowerCase().trim()).digest("hex");
    return `search:semantic:${conversationId}:${queryHash}:limit:${limit}:threshold:${threshold}`;
}
export function semanticSearchPattern(conversationId) {
    return `search:semantic:${conversationId}:*`;
}
export function refreshTokenKey(token) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    return `token:refresh:${tokenHash}`;
}
export function conversationMetaKey(conversationId) {
    return `conversation:meta:${conversationId}`;
}
export function conversationMetaPattern(conversationId) {
    return `conversation:meta:${conversationId}`;
}
export function globalSearchKey(userId, query, page = 1) {
    const queryHash = crypto.createHash("md5").update(query.toLowerCase().trim()).digest("hex");
    return `search:global:user:${userId}:${queryHash}:page:${page}`;
}
export function globalSearchPattern(userId) {
    return `search:global:user:${userId}:*`;
}
export function popularTagsKey(userId) {
    return `tags:popular:user:${userId}`;
}
export function projectListKey(userId) {
    return `projects:user:${userId}`;
}
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
