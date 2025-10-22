import { searchConversationByEmbedding } from "../services/semantic-search.service.js";
/**
 * Semantic search endpoint
 * POST /api/conversations/:id/search
 *
 * Search for semantically similar messages within a conversation
 *
 * Request body:
 * - query: string (required) - Search query text
 * - limit: number (optional, default: 5) - Max results to return
 * - similarity_threshold: number (optional, default: 0.7) - Minimum similarity (0-1)
 *
 * Response:
 * - query: string - Original search query
 * - results: array - Matching messages with similarity scores
 * - count: number - Number of results found
 */
export const semanticSearch = async (req, res) => {
    try {
        // Get conversation ID from route params
        const conversationId = req.params.id;
        // Get user ID from authenticated request (set by auth middleware)
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                error: "Unauthorized",
                message: "User not authenticated",
            });
            return;
        }
        // Get search parameters from request body
        const { query, limit, similarity_threshold } = req.body;
        // Validate query
        if (!query || query.trim().length === 0) {
            res.status(400).json({
                error: "Bad Request",
                message: "Search query is required",
            });
            return;
        }
        // Validate limit if provided
        if (limit !== undefined) {
            if (typeof limit !== "number" || limit < 1 || limit > 50) {
                res.status(400).json({
                    error: "Bad Request",
                    message: "Limit must be a number between 1 and 50",
                });
                return;
            }
        }
        // Validate similarity_threshold if provided
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
        // Perform semantic search
        const searchResult = await searchConversationByEmbedding(conversationId, userId, {
            query,
            limit,
            similarity_threshold,
        });
        // Return results
        res.status(200).json({
            success: true,
            data: searchResult,
        });
    }
    catch (error) {
        // Handle specific errors
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
        if (error.message.includes("API key") || error.message.includes("not configured")) {
            res.status(503).json({
                error: "Service Unavailable",
                message: "Semantic search is not available. Please configure OpenAI API key.",
            });
            return;
        }
        // Generic error response
        res.status(500).json({
            error: "Internal Server Error",
            message: error.message || "Failed to perform semantic search",
        });
    }
};
export default {
    semanticSearch,
};
