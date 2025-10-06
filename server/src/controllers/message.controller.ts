import { Request, Response } from "express";
import {
  getConversationMessages,
  sendMessageAndGetResponse,
  deleteMessage,
} from "../services/message.service.js";
import User from "../models/user.model.js";

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
 * Get all messages for a conversation
 * GET /api/conversations/:id/messages
 * Query params: page, limit
 */
export const getMessages = async (req: Request, res: Response): Promise<void> => {
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

    // Extract pagination params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;

    // Validate pagination params
    if (page < 1 || limit < 1 || limit > 100) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
      return;
    }

    // Get messages
    const result = await getConversationMessages(conversationId, userId, page, limit);

    // Send success response
    res.status(200).json({
      success: true,
      message: "Messages retrieved successfully",
      data: result.messages,
      pagination: result.pagination,
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to get messages";

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
 * Send a user message and receive AI response
 * POST /api/conversations/:id/messages
 * Body: { content: string }
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
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

    // Extract message content from request body
    const { content } = req.body;

    // Validate content
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Message content is required",
      });
      return;
    }

    // Send message and get AI response
    const result = await sendMessageAndGetResponse(conversationId, userId, content);

    // Send success response with both messages
    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: result,
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to send message";

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

    if (errorMessage.includes("OpenAI") || errorMessage.includes("AI response")) {
      res.status(503).json({
        success: false,
        message: "AI service temporarily unavailable",
        error: errorMessage,
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
 * Delete a message
 * DELETE /api/messages/:messageId
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

    // Extract message ID from params
    const messageId = req.params.messageId;

    if (!messageId) {
      res.status(400).json({
        success: false,
        message: "Message ID is required",
      });
      return;
    }

    // Delete message
    const result = await deleteMessage(messageId, userId);

    // Send success response
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to delete message";

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
