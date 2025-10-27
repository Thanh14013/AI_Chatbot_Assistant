import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { getChatCompletion, buildContextArray, estimateTokenCount } from "./openai.service.js";
import { generateAndStoreEmbedding } from "./embedding.service.js";
import { buildEnhancedContext } from "./context-builder.service.js";
import { buildSystemPromptWithPreferences } from "./user-preference.service.js";
import { Op } from "sequelize";
import type { CreateMessageInput, MessageResponse } from "../types/message.type.js";
import { cacheAside, CACHE_TTL, invalidateCachePattern } from "./cache.service.js";
import {
  messageHistoryKey,
  messageHistoryPattern,
  contextPattern,
  recentMessagesKey,
  conversationListPattern,
} from "../utils/cache-key.util.js";

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

  // Update conversation totals to include this message's tokens and count
  conversation.total_tokens_used += tokens_used;
  conversation.message_count += 1;
  await conversation.save();

  // Invalidate related caches
  await invalidateCachePattern(messageHistoryPattern(data.conversation_id));
  await invalidateCachePattern(contextPattern(data.conversation_id));
  await invalidateCachePattern(conversationListPattern(conversation.user_id));

  // Generate and store embedding asynchronously (don't wait for it)
  // This runs in the background and doesn't block the response
  generateAndStoreEmbedding(message.id, message.content).catch(() => {
    // logging removed: background embedding generation failed for message
  });

  // Return message response
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    role: message.role,
    content: message.content,
    tokens_used: message.tokens_used,
    model: message.model,
    pinned: message.pinned,
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
  limit: number = 30,
  before?: string
): Promise<{
  messages: MessageResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}> => {
  // Use cache for message history
  const cacheKey = messageHistoryKey(conversationId, page, limit, before);
  const fetchMessages = async () => {
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

    // Get total message count (useful for full pagination)
    const total = await Message.count({
      where: { conversation_id: conversationId },
    });

    const totalPages = Math.ceil(total / limit);

    // If `before` provided, fetch messages older than the given message id
    if (before) {
      const beforeMsg = await Message.findByPk(before);
      if (!beforeMsg || beforeMsg.conversation_id !== conversationId) {
        throw new Error("Invalid 'before' message id");
      }

      const beforeDate = beforeMsg.createdAt;
      const beforeId = beforeMsg.id;

      // Find messages strictly older than the before message. If createdAt is equal,
      // use id comparison to have deterministic ordering.
      const olderMessages = await Message.findAll({
        where: {
          conversation_id: conversationId,
          [Op.or]: [
            { createdAt: { [Op.lt]: beforeDate } },
            { createdAt: beforeDate, id: { [Op.lt]: beforeId } },
          ],
        },
        order: [
          ["createdAt", "ASC"],
          ["id", "ASC"],
        ],
        limit,
      });

      // Map to response
      const messageResponses: MessageResponse[] = olderMessages.map((msg) => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.role,
        content: msg.content,
        tokens_used: msg.tokens_used,
        model: msg.model,
        pinned: msg.pinned,
        createdAt: msg.createdAt,
      }));

      // Fetch attachments for all messages
      const { default: fileUploadModel } = await import("../models/fileUpload.model.js");
      for (const msgResponse of messageResponses) {
        try {
          const attachments = await fileUploadModel.findByMessageId(msgResponse.id);
          if (attachments && attachments.length > 0) {
            msgResponse.attachments = attachments.map((att: any) => ({
              id: att.id,
              public_id: att.public_id,
              secure_url: att.secure_url,
              resource_type: att.resource_type,
              format: att.format,
              original_filename: att.original_filename,
              size_bytes: att.size_bytes,
              width: att.width,
              height: att.height,
              thumbnail_url: att.thumbnail_url,
              extracted_text: att.extracted_text,
              openai_file_id: att.openai_file_id, // Include OpenAI file_id
            }));
          }
        } catch (err) {
          // Don't fail if attachments fetch fails
        }
      }

      // Determine if there are more messages older than the first returned
      let hasMore = false;
      if (messageResponses.length > 0) {
        const first = messageResponses[0];
        const firstMsg = await Message.findByPk(first.id);
        if (firstMsg) {
          const olderCount = await Message.count({
            where: {
              conversation_id: conversationId,
              [Op.or]: [
                { createdAt: { [Op.lt]: firstMsg.createdAt } },
                { createdAt: firstMsg.createdAt, id: { [Op.lt]: firstMsg.id } },
              ],
            },
          });
          hasMore = olderCount > 0;
        }
      }

      return {
        messages: messageResponses,
        pagination: {
          page: 1,
          limit,
          total,
          totalPages,
          hasMore,
        },
      };
    }

    // Default behavior: page-based pagination from the end (latest messages)
    // Get messages in chronological order (oldest first)
    const allMessages = await Message.findAll({
      where: { conversation_id: conversationId },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });

    // Page 1 shows the last `limit` messages, page 2 shows the previous `limit`, etc.
    const startIndex = Math.max(0, total - page * limit);
    const endIndex = total - (page - 1) * limit;
    const paginatedMessages = allMessages.slice(startIndex, endIndex);

    const messageResponses: MessageResponse[] = paginatedMessages.map((msg) => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      tokens_used: msg.tokens_used,
      model: msg.model,
      pinned: msg.pinned,
      createdAt: msg.createdAt,
    }));

    // Fetch attachments for all messages
    const { default: fileUploadModel } = await import("../models/fileUpload.model.js");
    for (const msgResponse of messageResponses) {
      try {
        const attachments = await fileUploadModel.findByMessageId(msgResponse.id);
        if (attachments && attachments.length > 0) {
          msgResponse.attachments = attachments.map((att: any) => ({
            id: att.id,
            public_id: att.public_id,
            secure_url: att.secure_url,
            resource_type: att.resource_type,
            format: att.format,
            original_filename: att.original_filename,
            size_bytes: att.size_bytes,
            width: att.width,
            height: att.height,
            thumbnail_url: att.thumbnail_url,
            extracted_text: att.extracted_text,
          }));
        }
      } catch (err) {
        // Don't fail if attachments fetch fails
      }
    }

    return {
      messages: messageResponses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: startIndex > 0,
      },
    };
  };

  return await cacheAside(cacheKey, fetchMessages, CACHE_TTL.MESSAGE_HISTORY);
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
// non-streaming sendMessageAndGetResponse removed in favor of streaming API

/**
 * Send a user message and stream AI response via onChunk callback.
 * Persists the user message immediately and persists assistant response once complete.
 *
 * @param conversationId
 * @param userId
 * @param content
 * @param onChunk - callback invoked with each partial text chunk
 * @returns assistant message record
 */
export const sendMessageAndStreamResponse = async (
  conversationId: string,
  userId: string,
  content: string,
  onChunk: (chunk: string) => Promise<void> | void,
  // optional callback invoked immediately after the user message is persisted
  onUserMessageCreated?: (userMessage: any) => Promise<void> | void,
  // optional attachments array
  attachments?: Array<{
    public_id: string;
    secure_url: string;
    resource_type: string;
    format?: string;
    extracted_text?: string;
    openai_file_id?: string; // OpenAI File API ID
  }>
): Promise<any> => {
  if (!content || content.trim().length === 0) {
    throw new Error("Message content cannot be empty");
  }

  // Verify conversation and access
  const conversation = await Conversation.findOne({
    where: { id: conversationId, deleted_at: null },
  });
  if (!conversation) throw new Error("Conversation not found");
  if (conversation.user_id !== userId) throw new Error("Unauthorized access to conversation");

  // Step 1: persist user message FIRST
  const userTokens = estimateTokenCount(content);
  const userMessage = await Message.create({
    conversation_id: conversationId,
    role: "user",
    content: content.trim(),
    tokens_used: userTokens,
    model: conversation.model,
  });

  // Link attachments to this message if present
  if (attachments && attachments.length > 0) {
    try {
      const { default: fileUploadModel } = await import("../models/fileUpload.model.js");
      const publicIds = attachments.map((att) => att.public_id);
      await fileUploadModel.updateMessageId(publicIds, userMessage.id);
    } catch (err: any) {
      // Don't fail the entire request if linking fails
    }
  }

  // Invalidate message-related caches BEFORE broadcasting to prevent stale reads
  await invalidateCachePattern(messageHistoryPattern(conversationId));
  await invalidateCachePattern(contextPattern(conversationId));

  // Invoke callback so callers (socket server) can broadcast the persisted user message
  try {
    if (onUserMessageCreated) {
      // Fetch attachments for this message to include in broadcast
      let messageAttachments: any[] | undefined;
      if (attachments && attachments.length > 0) {
        try {
          const { default: fileUploadModel } = await import("../models/fileUpload.model.js");
          const fetchedAttachments = await fileUploadModel.findByMessageId(userMessage.id);
          if (fetchedAttachments && fetchedAttachments.length > 0) {
            messageAttachments = fetchedAttachments.map((att: any) => ({
              id: att.id,
              public_id: att.public_id,
              secure_url: att.secure_url,
              resource_type: att.resource_type,
              format: att.format,
              original_filename: att.original_filename,
              size_bytes: att.size_bytes,
              width: att.width,
              height: att.height,
              thumbnail_url: att.thumbnail_url,
              extracted_text: att.extracted_text,
              openai_file_id: att.openai_file_id, // Include OpenAI file_id
            }));
          }
        } catch (err: any) {}
      }

      await onUserMessageCreated({
        id: userMessage.id,
        conversation_id: userMessage.conversation_id,
        role: userMessage.role,
        content: userMessage.content,
        tokens_used: userMessage.tokens_used,
        model: userMessage.model,
        createdAt: userMessage.createdAt,
        attachments: messageAttachments,
      });
    }
  } catch (err) {
    // ignore errors from user callback to avoid breaking streaming
  }
  conversation.total_tokens_used += userTokens;
  conversation.message_count += 1;
  await conversation.save();

  // Invalidate conversation list cache AFTER updating totals
  await invalidateCachePattern(conversationListPattern(conversation.user_id));

  // Generate and store embedding for user message (async, non-blocking)
  generateAndStoreEmbedding(userMessage.id, userMessage.content).catch(() => {
    // logging removed: background embedding generation failed for user message
  });

  // Build context with user preferences
  const baseSystemPrompt =
    "You are a helpful AI assistant. Provide clear, accurate, and helpful responses.";

  // Get system prompt with user preferences applied
  const systemPrompt = await buildSystemPromptWithPreferences(userId, baseSystemPrompt);

  const disableContext = String(process.env.DISABLE_CONTEXT || "false").toLowerCase() === "true";
  const useSemanticContext =
    String(process.env.USE_SEMANTIC_CONTEXT || "false").toLowerCase() === "true";

  let contextMessages: Array<{ role: string; content: string }>;

  if (disableContext) {
    // Only include system prompt and the current user message
    contextMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: content.trim() },
    ];
  } else if (useSemanticContext) {
    // Use enhanced context builder with semantic search
    try {
      const enhancedContext = await buildEnhancedContext(conversationId, content.trim(), {
        recentLimit: Math.min(conversation.context_window, 15), // Last 15 messages max
        semanticLimit: 5, // Top 5 semantically relevant messages
        maxTokens: 4000,
        systemPrompt,
        useSemanticSearch: true,
      });
      contextMessages = enhancedContext;
    } catch {
      // If semantic context fails, fall back to simple recent messages
      // logging removed: semantic context failed, using recent messages
      // Fall through to simple context below
      const recentMessages = await Message.findAll({
        where: { conversation_id: conversationId },
        order: [["createdAt", "DESC"]],
        limit: conversation.context_window,
      });
      const recentMessagesChron = recentMessages.reverse();
      contextMessages = [];
      if (systemPrompt) {
        contextMessages.push({ role: "system", content: systemPrompt });
      }
      contextMessages.push(
        ...recentMessagesChron.map((m) => ({
          role: m.role,
          content: m.content,
        }))
      );
    }
  } else {
    // Fetch the N most recent messages from the conversation (including the user message we just created)
    // This gives us the complete conversation context up to this point
    const recentMessages = await Message.findAll({
      where: { conversation_id: conversationId },
      order: [["createdAt", "DESC"]], // newest-first for limiting
      limit: conversation.context_window, // Use the conversation's context window setting
    });

    // Reverse to chronological order (oldest -> newest)
    const recentMessagesChron = recentMessages.reverse();

    // Build context array: system prompt + N most recent messages (including current user message)
    contextMessages = [];
    if (systemPrompt) {
      contextMessages.push({ role: "system", content: systemPrompt });
    }

    // Add all N recent messages in chronological order
    // This includes the user message we just created, so no need to append it separately
    contextMessages.push(
      ...recentMessagesChron.map((m) => ({
        role: m.role,
        content: m.content,
      }))
    );
  }

  // Process attachments if present
  // Determine model to use - if attachments present, always use GPT-4o for multimodal support
  let modelToUse = conversation.model;

  if (attachments && attachments.length > 0) {
    // Import OpenAI service helpers
    const { buildMessageContentWithAttachments } = await import("./openai.service.js");

    // Force GPT-4o when attachments present (images, PDFs, CSVs, etc.)
    modelToUse = "gpt-4o";

    // Log attachments with file_id for debugging
    console.log("📎 [Message Service] Processing attachments for message", {
      conversationId,
      userId,
      messageContent: content.trim().substring(0, 100) + (content.length > 100 ? "..." : ""),
      attachments: attachments.map((att) => ({
        public_id: att.public_id,
        resource_type: att.resource_type,
        format: att.format,
        has_openai_file_id: !!att.openai_file_id,
        openai_file_id: att.openai_file_id,
      })),
    });

    // Build enhanced content for the last user message with attachments
    const enhancedContent = buildMessageContentWithAttachments(content.trim(), attachments);

    // Replace the last message (current user message) with enhanced version
    if (contextMessages.length > 0) {
      const lastMessage = contextMessages[contextMessages.length - 1];
      if (lastMessage.role === "user") {
        lastMessage.content = enhancedContent as any;
      }
    }
  }

  // Prepare payload for streaming
  const payload: any = {
    model: modelToUse, // Use determined model (gpt-4o if attachments, otherwise conversation model)
    messages: contextMessages,
    stream: true,
    max_completion_tokens: 2000,
  };

  // Only include temperature if supported by model
  if (!["gpt-5-nano"].includes(conversation.model)) {
    payload.temperature = 0.7;
  }

  // Log detailed structure of last message to verify attachments
  const lastMsg = payload.messages[payload.messages.length - 1];

  console.log("📤 [Message Service] Sending request to OpenAI API", {
    model: payload.model,
    messageCount: payload.messages.length,
    lastMessageType: Array.isArray(lastMsg.content) ? "multimodal" : "text",
    lastMessageContent: Array.isArray(lastMsg.content)
      ? JSON.stringify(lastMsg.content, null, 2).substring(0, 500)
      : lastMsg.content.substring(0, 200),
  });

  // Call OpenAI streaming
  const openai = (await import("./openai.service.js")).default;

  let stream;
  try {
    stream = await openai.chat.completions.create(payload);
    console.log("✅ [Message Service] OpenAI stream created successfully");
  } catch (error: any) {
    console.error("❌ [Message Service] Failed to create OpenAI stream", {
      error: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
    });
    throw error;
  }

  let fullContent = "";
  try {
    // streaming start
    // Buffer incoming deltas and emit grouped chunks of words (e.g. 1-2 words)
    const groupSize = 2; // emit every N words (tuneable)
    let buffer = "";

    console.log("🔄 [Message Service] Starting to process stream chunks...");
    let chunkCount = 0;

    for await (const chunk of stream) {
      chunkCount++;
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        const text = delta.content as string;
        fullContent += text;

        // Append to buffer and try to extract groups of words
        buffer += text;

        // Build a regex to capture the first `groupSize` words including leading whitespace
        const groupRegex = new RegExp(`^(\\s*\\S+(?:\\s+\\S+){${groupSize - 1}})`);
        let match = buffer.match(groupRegex);

        // Emit as many full groups as possible
        while (match) {
          const piece = match[1];
          // invoke callback with grouped piece
          try {
            await onChunk(piece);
          } catch (e) {
            // ignore onChunk errors to keep streaming
          }
          // remove emitted piece from buffer
          buffer = buffer.slice(match[0].length);
          match = buffer.match(groupRegex);
        }
      }
    }

    // After stream finishes, flush any remaining buffer (may contain partial words)
    if (buffer.length > 0) {
      try {
        await onChunk(buffer);
      } catch (e) {
        // ignore
      }
      buffer = "";
    }

    console.log("✅ [Message Service] Stream completed", {
      totalChunks: chunkCount,
      contentLength: fullContent.length,
      contentPreview: fullContent.substring(0, 200) + (fullContent.length > 200 ? "..." : ""),
    });

    // streaming complete

    // Estimate tokens
    const estimated_completion_tokens = estimateTokenCount(fullContent);
    const assistantMessage = await Message.create({
      conversation_id: conversationId,
      role: "assistant",
      content: fullContent,
      tokens_used: estimated_completion_tokens,
      model: conversation.model,
    });

    conversation.total_tokens_used += estimated_completion_tokens;
    conversation.message_count += 1;
    await conversation.save();

    // Invalidate related caches for assistant message too
    await invalidateCachePattern(messageHistoryPattern(conversationId));
    await invalidateCachePattern(contextPattern(conversationId));
    await invalidateCachePattern(conversationListPattern(conversation.user_id));

    // Generate and store embedding for assistant message (async, non-blocking)
    generateAndStoreEmbedding(assistantMessage.id, assistantMessage.content).catch((error) => {});

    // Return userMessage, assistantMessage, and updated conversation for client sync
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
        title: conversation.title,
        model: conversation.model,
        total_tokens_used: conversation.total_tokens_used,
        message_count: conversation.message_count,
        updatedAt: conversation.updatedAt,
      },
    };
  } catch (err: any) {
    // If stream errors, rethrow
    throw new Error(err?.message || "Streaming failed");
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
