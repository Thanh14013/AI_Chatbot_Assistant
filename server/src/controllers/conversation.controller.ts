import { Request, Response } from "express";
import {
  createConversation,
  getUserConversations,
  getConversationById,
  updateConversation,
  deleteConversation,
  generateConversationTitle,
  getPopularTags,
} from "../services/conversation.service.js";
import User from "../models/user.model.js";
import type {
  CreateConversationInput,
  UpdateConversationInput,
} from "../types/conversation.type.js";
import { validateAndNormalizeTags } from "../utils/tag.util.js";

/**
 * Helper function to get user ID from authenticated request
 */
const getUserIdFromRequest = async (req: Request): Promise<string | null> => {
  const userEmail = req.body?.user?.email;
  if (!userEmail) return null;

  const user = await User.findByEmail(userEmail);
  return user ? user.id : null;
};

/**
 * Create a new conversation
 * POST /api/conversations
 */
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Extract conversation data from request body
    const { title, model, context_window, tags }: CreateConversationInput = req.body;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Conversation title is required",
      });
      return;
    }

    // Validate tags if provided
    if (tags !== undefined) {
      const tagValidation = validateAndNormalizeTags(tags);
      if (!tagValidation.isValid) {
        res.status(400).json({
          success: false,
          message: "Invalid tags",
          errors: tagValidation.errors,
        });
        return;
      }
    }

    // Create conversation
    const conversationData: CreateConversationInput = {
      user_id: userId,
      title: title.trim(),
      model: model || "gpt-5-nano",
      context_window: context_window || 10,
      tags: tags || [],
    };

    const conversation = await createConversation(conversationData);

    // Send success response
    res.status(201).json({
      success: true,
      message: "Conversation created successfully",
      data: conversation,
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to create conversation";

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Get all conversations for authenticated user
 * GET /api/conversations
 * Query params: page, limit, search
 */
export const getAll = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Extract pagination params and search query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    // Extract tag filtering params
    const tagsParam = req.query.tags as string | undefined;
    const tagMode = (req.query.tagMode as "any" | "all") || "any";
    const tags = tagsParam
      ? tagsParam
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    // Validate pagination params
    if (page < 1 || limit < 1 || limit > 100) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
      return;
    }

    // Validate tag mode
    if (tagMode !== "any" && tagMode !== "all") {
      res.status(400).json({
        success: false,
        message: "Invalid tagMode. Must be 'any' or 'all'",
      });
      return;
    }

    // Get conversations with optional search and tag filtering
    const result = await getUserConversations(userId, page, limit, search, tags, tagMode);

    console.log(
      `[Conversation Controller] Sending response with ${result.conversations.length} conversations`
    );
    console.log(
      `[Conversation Controller] First conversation in response:`,
      result.conversations[0]
    );
    console.log(
      `[Conversation Controller] First conversation tags:`,
      result.conversations[0]?.tags
    );

    // Send success response
    res.status(200).json({
      success: true,
      message: "Conversations retrieved successfully",
      data: result.conversations,
      pagination: result.pagination,
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to get conversations";

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Get a specific conversation by ID
 * GET /api/conversations/:id
 */
export const getOne = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Extract conversation ID from params
    const conversationId = req.params.id;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
      return;
    }

    // Get conversation
    const conversation = await getConversationById(conversationId, userId);

    // Send success response
    res.status(200).json({
      success: true,
      message: "Conversation retrieved successfully",
      data: conversation,
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to get conversation";

    // Check for specific error types
    if (errorMessage.includes("not found")) {
      res.status(404).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    if (errorMessage.includes("Unauthorized")) {
      res.status(403).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Update a conversation
 * PATCH /api/conversations/:id
 */
export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Extract conversation ID from params
    const conversationId = req.params.id;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
      return;
    }

    // Extract update data from request body
    const { title, model, context_window, tags }: UpdateConversationInput = req.body;

    // Validate at least one field to update
    if (
      title === undefined &&
      model === undefined &&
      context_window === undefined &&
      tags === undefined
    ) {
      res.status(400).json({
        success: false,
        message: "At least one field to update is required",
      });
      return;
    }

    // Validate tags if provided
    if (tags !== undefined) {
      const tagValidation = validateAndNormalizeTags(tags);
      if (!tagValidation.isValid) {
        res.status(400).json({
          success: false,
          message: "Invalid tags",
          errors: tagValidation.errors,
        });
        return;
      }
    }

    // Update conversation
    const updateData: UpdateConversationInput = {};
    if (title !== undefined) updateData.title = title.trim();
    if (model !== undefined) updateData.model = model;
    if (context_window !== undefined) updateData.context_window = context_window;
    if (tags !== undefined) updateData.tags = tags;

    const conversation = await updateConversation(conversationId, userId, updateData);

    // Send success response
    res.status(200).json({
      success: true,
      message: "Conversation updated successfully",
      data: conversation,
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to update conversation";

    // Check for specific error types
    if (errorMessage.includes("not found")) {
      res.status(404).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    if (errorMessage.includes("Unauthorized")) {
      res.status(403).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Delete a conversation (soft delete)
 * DELETE /api/conversations/:id
 */
export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Extract conversation ID from params
    const conversationId = req.params.id;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
      return;
    }

    // Delete conversation
    const result = await deleteConversation(conversationId, userId);

    // After deletion, fetch refreshed conversation list for the user.
    // Use page/limit from query params if provided so the client can
    // control which page is returned after delete; default to 1/20.
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const conversationsResult = await getUserConversations(userId, page, limit);

    // Send success response with refreshed list
    res.status(200).json({
      success: true,
      message: result.message,
      data: conversationsResult.conversations,
      pagination: conversationsResult.pagination,
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to delete conversation";

    // Check for specific error types
    if (errorMessage.includes("not found")) {
      res.status(404).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    if (errorMessage.includes("Unauthorized")) {
      res.status(403).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Generate a smart title for a conversation based on message content
 * POST /api/conversations/generate-title
 */
export const generateTitle = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Extract message content from request body
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Message content is required",
      });
      return;
    }

    // Generate title using the service
    const title = await generateConversationTitle(content.trim(), "");

    // Send success response
    res.status(200).json({
      success: true,
      message: "Title generated successfully",
      data: { title },
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to generate title";

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Get popular tags for authenticated user
 * GET /api/conversations/tags/popular
 */
export const getPopularTagsController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Get popular tags
    const tags = await getPopularTags(userId);

    // Send success response
    res.status(200).json({
      success: true,
      message: "Popular tags retrieved successfully",
      data: { tags },
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to get popular tags";

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};
