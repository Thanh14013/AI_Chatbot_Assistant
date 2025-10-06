import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import type {
  CreateConversationInput,
  UpdateConversationInput,
  ConversationResponse,
} from "../types/conversation.type.js";

/**
 * Create a new conversation
 *
 * @param data - Conversation creation data
 * @returns Created conversation
 */
export const createConversation = async (
  data: CreateConversationInput
): Promise<ConversationResponse> => {
  // Validate required fields
  if (!data.user_id || !data.title) {
    throw new Error("User ID and title are required");
  }

  // Create conversation with default values
  const conversation = await Conversation.create({
    user_id: data.user_id,
    title: data.title,
    model: data.model || "gpt-5-nano",
    context_window: data.context_window || 10,
    total_tokens_used: 0,
    message_count: 0,
    deleted_at: null,
  });

  // Return conversation response
  return {
    id: conversation.id,
    user_id: conversation.user_id,
    title: conversation.title,
    model: conversation.model,
    context_window: conversation.context_window,
    total_tokens_used: conversation.total_tokens_used,
    message_count: conversation.message_count,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    deleted_at: conversation.deleted_at,
  };
};

/**
 * Get all conversations for a user with pagination
 *
 * @param userId - User ID
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 20)
 * @returns Array of conversations with pagination info
 */
export const getUserConversations = async (
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  conversations: ConversationResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  // Calculate offset
  const offset = (page - 1) * limit;

  // Get total count for pagination
  const total = await Conversation.count({
    where: {
      user_id: userId,
      deleted_at: null,
    },
  });

  // Get conversations with pagination
  const conversations = await Conversation.findAll({
    where: {
      user_id: userId,
      deleted_at: null,
    },
    order: [["updatedAt", "DESC"]], // Most recently updated first
    limit,
    offset,
  });

  // Map to response format
  const conversationResponses: ConversationResponse[] = conversations.map((conv) => ({
    id: conv.id,
    user_id: conv.user_id,
    title: conv.title,
    model: conv.model,
    context_window: conv.context_window,
    total_tokens_used: conv.total_tokens_used,
    message_count: conv.message_count,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    deleted_at: conv.deleted_at,
  }));

  // Calculate total pages
  const totalPages = Math.ceil(total / limit);

  return {
    conversations: conversationResponses,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

/**
 * Get a specific conversation by ID
 *
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization check)
 * @returns Conversation details
 * @throws Error if conversation not found or user not authorized
 */
export const getConversationById = async (
  conversationId: string,
  userId: string
): Promise<ConversationResponse> => {
  // Find conversation
  const conversation = await Conversation.findOne({
    where: {
      id: conversationId,
      deleted_at: null,
    },
  });

  // Check if conversation exists
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Check if user is authorized
  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to conversation");
  }

  // Return conversation response
  return {
    id: conversation.id,
    user_id: conversation.user_id,
    title: conversation.title,
    model: conversation.model,
    context_window: conversation.context_window,
    total_tokens_used: conversation.total_tokens_used,
    message_count: conversation.message_count,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    deleted_at: conversation.deleted_at,
  };
};

/**
 * Update a conversation
 *
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization check)
 * @param data - Update data
 * @returns Updated conversation
 * @throws Error if conversation not found or user not authorized
 */
export const updateConversation = async (
  conversationId: string,
  userId: string,
  data: UpdateConversationInput
): Promise<ConversationResponse> => {
  // Find conversation
  const conversation = await Conversation.findOne({
    where: {
      id: conversationId,
      deleted_at: null,
    },
  });

  // Check if conversation exists
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Check if user is authorized
  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to conversation");
  }

  // Update fields if provided
  if (data.title !== undefined) {
    conversation.title = data.title;
  }
  if (data.model !== undefined) {
    conversation.model = data.model;
  }
  if (data.context_window !== undefined) {
    conversation.context_window = data.context_window;
  }

  // Save changes
  await conversation.save();

  // Return updated conversation
  return {
    id: conversation.id,
    user_id: conversation.user_id,
    title: conversation.title,
    model: conversation.model,
    context_window: conversation.context_window,
    total_tokens_used: conversation.total_tokens_used,
    message_count: conversation.message_count,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    deleted_at: conversation.deleted_at,
  };
};

/**
 * Soft delete a conversation
 *
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization check)
 * @returns Deleted conversation
 * @throws Error if conversation not found or user not authorized
 */
export const deleteConversation = async (
  conversationId: string,
  userId: string
): Promise<{ message: string }> => {
  // Find conversation
  const conversation = await Conversation.findOne({
    where: {
      id: conversationId,
      deleted_at: null,
    },
  });

  // Check if conversation exists
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Check if user is authorized
  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to conversation");
  }

  // Soft delete (set deleted_at timestamp)
  conversation.deleted_at = new Date();
  await conversation.save();

  return {
    message: "Conversation deleted successfully",
  };
};
