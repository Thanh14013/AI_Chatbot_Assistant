import type { Request, Response } from "express";
import {
  searchAllConversations,
  searchWithinConversation,
} from "../services/global-search.service.js";
import type { SemanticSearchRequest } from "../types/embedding.type.js";

/**
 * Global semantic search across all user's conversations
 * POST /api/search/all
 *
 * Search for semantically similar messages across all conversations
 *
 * Request body:
 * - query: string (required) - Search query text
 * - limit: number (optional, default: 10) - Max conversations to return
 * - messagesPerConversation: number (optional, default: 3) - Top messages per conversation
 * - similarity_threshold: number (optional, default: 0.7) - Minimum similarity (0-1)
 *
 * Response:
 * - query: string - Original search query
 * - results: array - Matching conversations with their best messages
 * - totalConversations: number - Total conversations found
 */
export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    // Helper: normalize user extraction (support decoded token with id or email)
    const decoded = (req as any).user || (req as any).body?.user;

    // Try to obtain user id directly; if only email present, look up id from DB in calling service
    const userId = decoded?.id || decoded?.userId || null;

    if (!userId && !decoded?.email) {
      res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
      return;
    }

    // Get search parameters from request body
    const { query, tags, limit, messagesPerConversation, similarity_threshold } = req.body;

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

    // Validate messagesPerConversation if provided
    if (messagesPerConversation !== undefined) {
      if (
        typeof messagesPerConversation !== "number" ||
        messagesPerConversation < 1 ||
        messagesPerConversation > 10
      ) {
        res.status(400).json({
          error: "Bad Request",
          message: "messagesPerConversation must be a number between 1 and 10",
        });
        return;
      }
    }

    // Validate similarity_threshold if provided
    if (similarity_threshold !== undefined) {
      if (
        typeof similarity_threshold !== "number" ||
        similarity_threshold < 0 ||
        similarity_threshold > 1
      ) {
        res.status(400).json({
          error: "Bad Request",
          message: "Similarity threshold must be a number between 0 and 1",
        });
        return;
      }
    }

    // Validate tags if provided
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        res.status(400).json({
          error: "Bad Request",
          message: "Tags must be an array of strings",
        });
        return;
      }
      // Validate each tag
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

    // Perform global search
    // If userId not directly available, pass the decoded.email so the service layer can resolve it
    const searchInputUser = userId || decoded?.email;

    // Debug logging removed for search parameters

    const searchResult = await searchAllConversations(searchInputUser, {
      query,
      tags,
      limit,
      messagesPerConversation,
      similarity_threshold,
    });

    // Search results summary log removed

    // Return results
    res.status(200).json({
      success: true,
      data: searchResult,
    });
  } catch (error: any) {
    // Handle specific errors
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
      message: error.message || "Failed to perform global search",
    });
  }
};

/**
 * Search within a specific conversation and get message context
 * POST /api/search/conversation/:id
 *
 * Similar to existing semantic search but returns full context for highlighting
 *
 * Request body:
 * - query: string (required) - Search query text
 * - limit: number (optional, default: 5) - Max results to return
 * - contextMessages: number (optional, default: 2) - Messages before/after for context
 *
 * Response:
 * - query: string
 * - bestMatch: object - The best matching message
 * - results: array - All matching messages with context
 */
export const conversationSearchWithContext = async (req: Request, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.id;
    const decoded = (req as any).user || (req as any).body?.user;
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

    // Perform search with context
    // If userId not available, pass email to service and let it resolve
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
  } catch (error: any) {
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
