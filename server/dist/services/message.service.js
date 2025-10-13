import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { buildContextArray, estimateTokenCount } from "./openai.service.js";
/**
 * Create a new message
 *
 * @param data - Message creation data
 * @returns Created message
 */
export const createMessage = async (data) => {
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
export const getConversationMessages = async (conversationId, userId, page = 1, limit = 30) => {
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
    const messageResponses = paginatedMessages.map((msg) => ({
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
export const sendMessageAndStreamResponse = async (conversationId, userId, content, onChunk, 
// optional callback invoked immediately after the user message is persisted
onUserMessageCreated) => {
    if (!content || content.trim().length === 0) {
        throw new Error("Message content cannot be empty");
    }
    // Verify conversation and access
    const conversation = await Conversation.findOne({
        where: { id: conversationId, deleted_at: null },
    });
    if (!conversation)
        throw new Error("Conversation not found");
    if (conversation.user_id !== userId)
        throw new Error("Unauthorized access to conversation");
    // Step 1: persist user message
    const userTokens = estimateTokenCount(content);
    const userMessage = await Message.create({
        conversation_id: conversationId,
        role: "user",
        content: content.trim(),
        tokens_used: userTokens,
        model: conversation.model,
    });
    // Invoke callback so callers (socket server) can broadcast the persisted user message
    try {
        if (onUserMessageCreated) {
            await onUserMessageCreated({
                id: userMessage.id,
                conversation_id: userMessage.conversation_id,
                role: userMessage.role,
                content: userMessage.content,
                tokens_used: userMessage.tokens_used,
                model: userMessage.model,
                createdAt: userMessage.createdAt,
            });
        }
    }
    catch (err) {
        // ignore errors from user callback to avoid breaking streaming
    }
    conversation.total_tokens_used += userTokens;
    conversation.message_count += 1;
    await conversation.save();
    // Build context
    const systemPrompt = "You are a helpful AI assistant. Provide clear, accurate, and helpful responses.";
    const disableContext = String(process.env.DISABLE_CONTEXT || "false").toLowerCase() === "true";
    let contextMessages;
    if (disableContext) {
        // Only include system prompt and the current user message
        contextMessages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: content.trim() },
        ];
    }
    else {
        // Use the findRecentMessages method to get the most recent messages
        const recentMessages = await Message.findRecentMessages(conversationId, conversation.context_window);
        const messagesForContext = recentMessages.map((m) => ({ role: m.role, content: m.content }));
        contextMessages = buildContextArray(messagesForContext, conversation.context_window, systemPrompt, 4000);
    }
    // Prepare payload for streaming
    const payload = {
        model: conversation.model,
        messages: contextMessages,
        stream: true,
        max_completion_tokens: 2000,
    };
    // Only include temperature if supported by model
    if (!["gpt-5-nano"].includes(conversation.model)) {
        payload.temperature = 0.7;
    }
    // TEMP DEBUG: Log the context messages payload to help debug missing context
    // (Keep this temporary; remove after diagnosis)
    try {
        const safeMessagesPreview = contextMessages.map((m) => ({ role: m.role, content: (m.content || "").slice(0, 2000) }));
        // Use console.debug to keep noise lower in normal logs; some environments may still show it
        // This will print the system prompt and the most recent N messages being sent to OpenAI
        // Note: don't log full production data for privacy-sensitive deployments
        // eslint-disable-next-line no-console
        console.debug("DEBUG: OpenAI payload messages preview:", JSON.stringify(safeMessagesPreview, null, 2));
        // eslint-disable-next-line no-console
        console.debug("DEBUG: context_messages_count:", contextMessages.length, "context_window:", conversation.context_window);
    }
    catch (e) {
        // ignore logging errors
    }
    // Call OpenAI streaming
    const openai = (await import("./openai.service.js")).default;
    const stream = await openai.chat.completions.create(payload);
    let fullContent = "";
    try {
        // streaming start
        // Buffer incoming deltas and emit grouped chunks of words (e.g. 1-2 words)
        const groupSize = 2; // emit every N words (tuneable)
        let buffer = "";
        for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
                const text = delta.content;
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
                    }
                    catch (e) {
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
            }
            catch (e) {
                // ignore
            }
            buffer = "";
        }
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
    }
    catch (err) {
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
export const deleteMessage = async (messageId, userId) => {
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
    conversation.total_tokens_used = Math.max(0, conversation.total_tokens_used - message.tokens_used);
    await conversation.save();
    return {
        message: "Message deleted successfully",
    };
};
