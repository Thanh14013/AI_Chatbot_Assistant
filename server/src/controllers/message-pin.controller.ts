import { Request, Response } from "express";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";

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
 * Pin a message
 * PATCH /api/messages/:messageId/pin
 */
export const pinMessage = async (req: Request, res: Response): Promise<void> => {
  console.log("📌 [PIN_MESSAGE] ===== Pin Message Request Started =====");

  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      console.warn("⚠️ [PIN_MESSAGE] Authentication failed - no user ID");
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    console.log(`📌 [PIN_MESSAGE] User ID: ${userId}`);

    // Extract message ID from params
    const messageId = req.params.messageId;
    if (!messageId) {
      console.warn("⚠️ [PIN_MESSAGE] No message ID provided");
      res.status(400).json({
        success: false,
        message: "Message ID is required",
      });
      return;
    }

    console.log(`📌 [PIN_MESSAGE] Message ID: ${messageId}`);

    // Find the message
    const message = await Message.findByPk(messageId);
    if (!message) {
      console.error(`❌ [PIN_MESSAGE] Message not found: ${messageId}`);
      res.status(404).json({
        success: false,
        message: "Message not found",
      });
      return;
    }

    console.log(`📌 [PIN_MESSAGE] Message found, conversation_id: ${message.conversation_id}`);

    // Check if user owns the conversation
    const conversation = await Conversation.findByPk(message.conversation_id);
    if (!conversation) {
      console.error(`❌ [PIN_MESSAGE] Conversation not found: ${message.conversation_id}`);
      res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
      return;
    }

    if (conversation.user_id !== userId) {
      console.warn(
        `⚠️ [PIN_MESSAGE] Unauthorized access attempt by user ${userId} for conversation ${conversation.id}`
      );
      res.status(403).json({
        success: false,
        message: "Unauthorized: You can only pin messages in your own conversations",
      });
      return;
    }

    console.log(`📌 [PIN_MESSAGE] Authorization passed for user ${userId}`);

    // Check if message is already pinned
    if (message.pinned) {
      console.log(`ℹ️ [PIN_MESSAGE] Message already pinned: ${messageId}`);
      res.status(200).json({
        success: true,
        message: "Message is already pinned",
        data: {
          id: message.id,
          pinned: message.pinned,
        },
      });
      return;
    }

    // Check pinned message limit (max 10 per conversation)
    const pinnedCount = await Message.countPinnedByConversation(message.conversation_id);
    console.log(`📌 [PIN_MESSAGE] Current pinned count: ${pinnedCount}`);

    if (pinnedCount >= 10) {
      console.warn(
        `⚠️ [PIN_MESSAGE] Pin limit reached (${pinnedCount}/10) for conversation ${message.conversation_id}`
      );
      res.status(400).json({
        success: false,
        message: "Maximum number of pinned messages reached (10). Please unpin a message first.",
      });
      return;
    }

    // Pin the message
    console.log(`📌 [PIN_MESSAGE] Pinning message: ${messageId}`);
    const updatedMessage = await Message.pinMessage(messageId);

    console.log(`✅ [PIN_MESSAGE] Message pinned successfully: ${messageId}`);
    console.log("📌 [PIN_MESSAGE] ===== Pin Message Request Completed =====");

    // Send success response
    res.status(200).json({
      success: true,
      message: "Message pinned successfully",
      data: {
        id: updatedMessage.id,
        pinned: updatedMessage.pinned,
      },
    });
  } catch (error) {
    console.error("❌ [PIN_MESSAGE] Error occurred:", error);

    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to pin message";

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Unpin a message
 * PATCH /api/messages/:messageId/unpin
 */
export const unpinMessage = async (req: Request, res: Response): Promise<void> => {
  console.log("📌 [UNPIN_MESSAGE] ===== Unpin Message Request Started =====");

  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      console.warn("⚠️ [UNPIN_MESSAGE] Authentication failed - no user ID");
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    console.log(`📌 [UNPIN_MESSAGE] User ID: ${userId}`);

    // Extract message ID from params
    const messageId = req.params.messageId;
    if (!messageId) {
      console.warn("⚠️ [UNPIN_MESSAGE] No message ID provided");
      res.status(400).json({
        success: false,
        message: "Message ID is required",
      });
      return;
    }

    console.log(`📌 [UNPIN_MESSAGE] Message ID: ${messageId}`);

    // Find the message
    const message = await Message.findByPk(messageId);
    if (!message) {
      console.error(`❌ [UNPIN_MESSAGE] Message not found: ${messageId}`);
      res.status(404).json({
        success: false,
        message: "Message not found",
      });
      return;
    }

    console.log(`📌 [UNPIN_MESSAGE] Message found, conversation_id: ${message.conversation_id}`);

    // Check if user owns the conversation
    const conversation = await Conversation.findByPk(message.conversation_id);
    if (!conversation) {
      console.error(`❌ [UNPIN_MESSAGE] Conversation not found: ${message.conversation_id}`);
      res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
      return;
    }

    if (conversation.user_id !== userId) {
      console.warn(
        `⚠️ [UNPIN_MESSAGE] Unauthorized access attempt by user ${userId} for conversation ${conversation.id}`
      );
      res.status(403).json({
        success: false,
        message: "Unauthorized: You can only unpin messages in your own conversations",
      });
      return;
    }

    console.log(`📌 [UNPIN_MESSAGE] Authorization passed for user ${userId}`);

    // Check if message is not pinned
    if (!message.pinned) {
      console.log(`ℹ️ [UNPIN_MESSAGE] Message is not pinned: ${messageId}`);
      res.status(200).json({
        success: true,
        message: "Message is not pinned",
        data: {
          id: message.id,
          pinned: message.pinned,
        },
      });
      return;
    }

    // Unpin the message
    console.log(`📌 [UNPIN_MESSAGE] Unpinning message: ${messageId}`);
    const updatedMessage = await Message.unpinMessage(messageId);

    console.log(`✅ [UNPIN_MESSAGE] Message unpinned successfully: ${messageId}`);
    console.log("📌 [UNPIN_MESSAGE] ===== Unpin Message Request Completed =====");

    // Send success response
    res.status(200).json({
      success: true,
      message: "Message unpinned successfully",
      data: {
        id: updatedMessage.id,
        pinned: updatedMessage.pinned,
      },
    });
  } catch (error) {
    console.error("❌ [UNPIN_MESSAGE] Error occurred:", error);

    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to unpin message";

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Get all pinned messages in a conversation
 * GET /api/conversations/:id/messages/pinned
 */
export const getPinnedMessages = async (req: Request, res: Response): Promise<void> => {
  console.log("📌 [GET_PINNED] ===== Get Pinned Messages Request Started =====");

  try {
    // Get user ID from authenticated request
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      console.warn("⚠️ [GET_PINNED] Authentication failed - no user ID");
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    console.log(`📌 [GET_PINNED] User ID: ${userId}`);

    // Extract conversation ID from params
    const conversationId = req.params.id;
    if (!conversationId) {
      console.warn("⚠️ [GET_PINNED] No conversation ID provided");
      res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
      return;
    }

    console.log(`📌 [GET_PINNED] Conversation ID: ${conversationId}`);

    // Check if conversation exists and user owns it
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      console.error(`❌ [GET_PINNED] Conversation not found: ${conversationId}`);
      res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
      return;
    }

    if (conversation.user_id !== userId) {
      console.warn(
        `⚠️ [GET_PINNED] Unauthorized access attempt by user ${userId} for conversation ${conversationId}`
      );
      res.status(403).json({
        success: false,
        message: "Unauthorized: You can only view pinned messages in your own conversations",
      });
      return;
    }

    console.log(`📌 [GET_PINNED] Authorization passed for user ${userId}`);

    // Get pinned messages
    console.log(`📌 [GET_PINNED] Fetching pinned messages for conversation: ${conversationId}`);
    const pinnedMessages = await Message.findPinnedMessages(conversationId);

    console.log(`✅ [GET_PINNED] Found ${pinnedMessages.length} pinned messages`);
    console.log("📌 [GET_PINNED] ===== Get Pinned Messages Request Completed =====");

    // Send success response
    res.status(200).json({
      success: true,
      messages: pinnedMessages,
      count: pinnedMessages.length,
    });
  } catch (error) {
    console.error("❌ [GET_PINNED] Error occurred:", error);

    // Handle errors
    const errorMessage = error instanceof Error ? error.message : "Failed to get pinned messages";

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};
