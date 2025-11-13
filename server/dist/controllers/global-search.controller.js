import { searchAllConversations, searchWithinConversation, } from "../services/global-search.service.js";
export const globalSearch = async (req, res) => {
    try {
        const decoded = req.user || req.body?.user;
        const userId = decoded?.id || decoded?.userId || null;
        if (!userId && !decoded?.email) {
            res.status(401).json({
                error: "Unauthorized",
                message: "User not authenticated",
            });
            return;
        }
        const { query, tags, limit, messagesPerConversation, similarity_threshold } = req.body;
        if (!query || query.trim().length === 0) {
            res.status(400).json({
                error: "Bad Request",
                message: "Search query is required",
            });
            return;
        }
        if (limit !== undefined) {
            if (typeof limit !== "number" || limit < 1 || limit > 50) {
                res.status(400).json({
                    error: "Bad Request",
                    message: "Limit must be a number between 1 and 50",
                });
                return;
            }
        }
        if (messagesPerConversation !== undefined) {
            if (typeof messagesPerConversation !== "number" ||
                messagesPerConversation < 1 ||
                messagesPerConversation > 10) {
                res.status(400).json({
                    error: "Bad Request",
                    message: "messagesPerConversation must be a number between 1 and 10",
                });
                return;
            }
        }
        if (similarity_threshold !== undefined) {
            if (typeof similarity_threshold !== "number" ||
                similarity_threshold < 0 ||
                similarity_threshold > 1) {
                res.status(400).json({
                    error: "Bad Request",
                    message: "Similarity threshold must be a number between 0 and 1",
                });
                return;
            }
        }
        if (tags !== undefined) {
            if (!Array.isArray(tags)) {
                res.status(400).json({
                    error: "Bad Request",
                    message: "Tags must be an array of strings",
                });
                return;
            }
            for (const tag of tags) {
                if (typeof tag !== "string" || tag.trim().length === 0) {
                    res.status(400).json({
                        error: "Bad Request",
                        message: "Each tag must be a non-empty string",
                    });
                    return;
                }
            }
        }
        const searchInputUser = userId || decoded?.email;
        const searchResult = await searchAllConversations(searchInputUser, {
            query,
            tags,
            limit,
            messagesPerConversation,
            similarity_threshold,
        });
        res.status(200).json({
            success: true,
            data: searchResult,
        });
    }
    catch (error) {
        if (error.message.includes("API key") || error.message.includes("not configured")) {
            res.status(503).json({
                error: "Service Unavailable",
                message: "Semantic search is not available. Please configure OpenAI API key.",
            });
            return;
        }
        res.status(500).json({
            error: "Internal Server Error",
            message: error.message || "Failed to perform global search",
        });
    }
};
export const conversationSearchWithContext = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const decoded = req.user || req.body?.user;
        const userId = decoded?.id || decoded?.userId || null;
        if (!userId && !decoded?.email) {
            res.status(401).json({
                error: "Unauthorized",
                message: "User not authenticated",
            });
            return;
        }
        const { query, limit, contextMessages } = req.body;
        if (!query || query.trim().length === 0) {
            res.status(400).json({
                error: "Bad Request",
                message: "Search query is required",
            });
            return;
        }
        const searchInputUser = userId || decoded?.email;
        const searchResult = await searchWithinConversation(conversationId, searchInputUser, {
            query,
            limit,
            contextMessages,
        });
        res.status(200).json({
            success: true,
            data: searchResult,
        });
    }
    catch (error) {
        if (error.message.includes("not found")) {
            res.status(404).json({
                error: "Not Found",
                message: error.message,
            });
            return;
        }
        if (error.message.includes("Unauthorized")) {
            res.status(403).json({
                error: "Forbidden",
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            error: "Internal Server Error",
            message: error.message || "Failed to search conversation",
        });
    }
};
export default {
    globalSearch,
    conversationSearchWithContext,
};
