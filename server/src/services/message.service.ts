import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { getChatCompletion, buildContextArray, estimateTokenCount } from "./openai.service.js";
import type {
  CreateMessageInput,
  MessageResponse,
  SendMessageResponse,
} from "../types/message.type.js";

/**
 * Create a new message
 *
 * @param data - Message creation data
 * @returns Created message
 */
export const createMessage = async (data: CreateMessageInput): Promise<MessageResponse> => {
  // Validate required fields
  if (!data.conversation_id || !data.content || !data.role) {
    throw new Error("Conversation ID, content, and role are required");
  }

  // Get conversation to retrieve model
  const conversation = await Conversation.findByPk(data.conversation_id);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Estimate tokens if not provided
  const tokens_used = data.tokens_used || estimateTokenCount(data.content);

  // Create message
  const message = await Message.create({
    conversation_id: data.conversation_id,
    role: data.role,
    content: data.content,
    tokens_used,
    model: data.model || conversation.model,
  });

  // Return message response
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    role: message.role,
    content: message.content,
    tokens_used: message.tokens_used,
    model: message.model,
    createdAt: message.createdAt,
  };
};

/**
 * Get all messages for a conversation with pagination
 *
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization check)
 * @param page - Page number (default: 1)
 * @param limit - Messages per page (default: 30)
 * @returns Array of messages with pagination info
 */
export const getConversationMessages = async (
  conversationId: string,
  userId: string,
  page: number = 1,
  limit: number = 30
): Promise<{
  messages: MessageResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  // Verify conversation exists and user has access
  const conversation = await Conversation.findOne({
    where: {
      id: conversationId,
      deleted_at: null,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to conversation");
  }

  // Get total message count
  const total = await Message.count({
    where: { conversation_id: conversationId },
  });

  // Calculate offset (for pagination from the end, we need special logic)
  // We want to show the most recent messages first, paginating backwards
  const totalPages = Math.ceil(total / limit);

  // Get messages in chronological order (oldest first)
  const allMessages = await Message.findAll({
    where: { conversation_id: conversationId },
    order: [["createdAt", "ASC"]],
  });

  // Get the slice for the current page
  // Page 1 shows the last 30 messages, page 2 shows 31-60 from the end, etc.
  const startIndex = Math.max(0, total - page * limit);
  const endIndex = total - (page - 1) * limit;
  const paginatedMessages = allMessages.slice(startIndex, endIndex);

  // Map to response format
  const messageResponses: MessageResponse[] = paginatedMessages.map((msg) => ({
    id: msg.id,
    conversation_id: msg.conversation_id,
    role: msg.role,
    content: msg.content,
    tokens_used: msg.tokens_used,
    model: msg.model,
    createdAt: msg.createdAt,
  }));

  return {
    messages: messageResponses,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

/**
 * Send a user message and get AI response
 * This function:
 * 1. Saves the user message to database
 * 2. Builds context from conversation history
 * 3. Calls OpenAI API to get response
 * 4. Saves AI response to database
 * 5. Updates conversation stats
 * 6. Returns both messages
 *
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization check)
 * @param content - User message content
 * @returns User message and AI response
 */
export const sendMessageAndGetResponse = async (
  conversationId: string,
  userId: string,
  content: string
): Promise<SendMessageResponse> => {
  // Validate input
  if (!content || content.trim().length === 0) {
    throw new Error("Message content cannot be empty");
  }

  // Get conversation and verify access
  const conversation = await Conversation.findOne({
    where: {
      id: conversationId,
      deleted_at: null,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to conversation");
  }

  // Step 1: Save user message to database
  const userTokens = estimateTokenCount(content);
  const userMessage = await Message.create({
    conversation_id: conversationId,
    role: "user",
    content: content.trim(),
    tokens_used: userTokens,
    model: conversation.model,
  });

  try {
    // Step 2: Build context from conversation history
    // Get recent messages for context (including the one we just created)
    const recentMessages = await Message.findAll({
      where: { conversation_id: conversationId },
      order: [["createdAt", "ASC"]],
      limit: conversation.context_window,
    });

    // Convert to format for OpenAI API
    const messagesForContext = recentMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Build context array with system prompt
    const systemPrompt =
      "You are a helpful AI assistant. Provide clear, accurate, and helpful responses.";
    const contextMessages = buildContextArray(
      messagesForContext,
      conversation.context_window,
      systemPrompt,
      4000 // Max tokens for context
    );

    // Step 3: Call OpenAI API
    // Prepare chat params and only include temperature when supported
    const modelSupportsTemperature = (modelName: string) => {
      const notSupporting = ["gpt-5-nano"];
      return !notSupporting.includes(modelName);
    };

    const chatParams: any = {
      messages: contextMessages,
      model: conversation.model,
      max_completion_tokens: 1000,
      stream: false,
    };

    if (modelSupportsTemperature(conversation.model)) {
      chatParams.temperature = 0.7;
    }

    const aiResponse = await getChatCompletion(chatParams);

    // Step 4: Save AI response to database
    const assistantMessage = await Message.create({
      conversation_id: conversationId,
      role: "assistant",
      content: aiResponse.content,
      tokens_used: aiResponse.tokens_used,
      model: conversation.model,
    });

    // Step 5: Update conversation stats
    const totalTokensUsed = userTokens + aiResponse.tokens_used;
    conversation.total_tokens_used += totalTokensUsed;
    conversation.message_count += 2; // User message + AI response
    await conversation.save(); // This will automatically update updatedAt timestamp

    // Step 6: Return both messages
    return {
      userMessage: {
        id: userMessage.id,
        conversation_id: userMessage.conversation_id,
        role: userMessage.role,
        content: userMessage.content,
        tokens_used: userMessage.tokens_used,
        model: userMessage.model,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        conversation_id: assistantMessage.conversation_id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        tokens_used: assistantMessage.tokens_used,
        model: assistantMessage.model,
        createdAt: assistantMessage.createdAt,
      },
      conversation: {
        id: conversation.id,
        total_tokens_used: conversation.total_tokens_used,
        message_count: conversation.message_count,
      },
    };
  } catch (error: any) {
    // If OpenAI API fails, we should still keep the user message
    // But we need to inform the user about the error
    throw new Error(`Failed to get AI response: ${error.message || "Unknown error"}`);
  }
};

/**
 * Delete a message
 *
 * @param messageId - Message ID
 * @param userId - User ID (for authorization check)
 * @returns Success message
 */
export const deleteMessage = async (
  messageId: string,
  userId: string
): Promise<{ message: string }> => {
  // Find message
  const message = await Message.findByPk(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  // Get conversation to verify user access
  const conversation = await Conversation.findByPk(message.conversation_id);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to message");
  }

  // Delete message
  await message.destroy();

  // Update conversation stats
  conversation.message_count = Math.max(0, conversation.message_count - 1);
  conversation.total_tokens_used = Math.max(
    0,
    conversation.total_tokens_used - message.tokens_used
  );
  await conversation.save();

  return {
    message: "Message deleted successfully",
  };
};
