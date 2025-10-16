import { Request, Response } from "express";
import {
  getConversationMessages,
  sendMessageAndStreamResponse,
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
    // Optional: load messages before a specific message id (infinite scroll)
    const before = req.query.before as string | undefined;

    // Validate pagination params
    if (page < 1 || limit < 1 || limit > 100) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
      return;
    }

    // Get messages
    const result = await getConversationMessages(conversationId, userId, page, limit, before);

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
  // sendMessage removed: streaming API (sendMessageStream) is used instead
  res
    .status(410)
    .json({ success: false, message: "Deprecated: use streaming endpoint /messages/stream" });
};

/**
 * Send message and stream AI response back to client via SSE
+
 * POST /api/conversations/:id/messages/stream
+
 */
export const sendMessageStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const conversationId = req.params.id;
    if (!conversationId) {
      res.status(400).json({ success: false, message: "Conversation ID is required" });
      return;
    }

    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ success: false, message: "Message content is required" });
      return;
    }

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Call service to stream; service will invoke onChunk for each partial piece
    await sendMessageAndStreamResponse(conversationId, userId, content, async (chunk) => {
      // Send SSE data event with chunk
      res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
    })
      .then((result) => {
        // Send final event with complete result (userMessage, assistantMessage, conversation)
        const doneEvent = { type: "done", ...result };
        res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
        // Close the stream
        res.end();
      })
      .catch((err) => {
        res.write(
          `data: ${JSON.stringify({ type: "error", message: err.message || String(err) })}\n\n`
        );
        res.end();
      });
  } catch (error: any) {
    const message = error?.message || "Failed to stream message";
    res.status(500).json({ success: false, message });
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
