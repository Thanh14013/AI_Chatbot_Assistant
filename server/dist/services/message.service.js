import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { estimateTokenCount } from "./openai.service.js";
import { generateAndStoreEmbedding } from "./embedding.service.js";
import { buildEnhancedContext } from "./context-builder.service.js";
import { buildSystemPromptWithPreferences } from "./user-preference.service.js";
import { Op } from "sequelize";
import { invalidateCachePattern } from "./cache.service.js";
import { messageHistoryPattern, contextPattern, conversationListPattern, } from "../utils/cache-key.util.js";
import { getCachedRecentMessages, cacheRecentMessages, addMessageToCache, } from "./message-cache.service.js";
export const createMessage = async (data) => {
    if (!data.conversation_id || !data.content || !data.role) {
        throw new Error("Conversation ID, content, and role are required");
    }
    const conversation = await Conversation.findByPk(data.conversation_id);
    if (!conversation) {
        throw new Error("Conversation not found");
    }
    const tokens_used = data.tokens_used || estimateTokenCount(data.content);
    const message = await Message.create({
        conversation_id: data.conversation_id,
        role: data.role,
        content: data.content,
        tokens_used,
        model: data.model || conversation.model,
    });
    conversation.total_tokens_used += tokens_used;
    conversation.message_count += 1;
    conversation.set("updatedAt", new Date());
    await conversation.save();
    await invalidateCachePattern(messageHistoryPattern(data.conversation_id));
    await invalidateCachePattern(contextPattern(data.conversation_id));
    await invalidateCachePattern(conversationListPattern(conversation.user_id));
    await addMessageToCache(data.conversation_id, {
        id: message.id,
        conversation_id: message.conversation_id,
        role: message.role,
        content: message.content,
        tokens_used: message.tokens_used,
        model: message.model || conversation.model,
        pinned: message.pinned,
        createdAt: message.createdAt,
    }).catch(() => {
    });
    generateAndStoreEmbedding(message.id, message.content).catch(() => {
    });
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
const attachMessagesData = async (messages) => {
    const messageResponses = messages.map((msg) => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.role,
        content: msg.content,
        tokens_used: msg.tokens_used,
        model: msg.model,
        pinned: msg.pinned,
        createdAt: msg.createdAt,
    }));
    const messageIds = messageResponses.map((m) => m.id);
    if (messageIds.length > 0) {
        try {
            const { default: pool } = await import("../db/pool.js");
            const attachmentsResult = await pool.query(`SELECT * FROM files_upload WHERE message_id = ANY($1) ORDER BY created_at ASC`, [messageIds]);
            const attachmentsByMessage = new Map();
            for (const att of attachmentsResult.rows) {
                if (!attachmentsByMessage.has(att.message_id)) {
                    attachmentsByMessage.set(att.message_id, []);
                }
                attachmentsByMessage.get(att.message_id).push({
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
                    openai_file_id: att.openai_file_id,
                });
            }
            for (const msgResponse of messageResponses) {
                msgResponse.attachments = attachmentsByMessage.get(msgResponse.id) || [];
            }
        }
        catch (err) {
        }
    }
    return messageResponses;
};
export const getConversationMessages = async (conversationId, userId, page = 1, limit = 50, before) => {
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
    if (page === 1 && !before) {
        const cachedMessages = await getCachedRecentMessages(conversationId, limit);
        if (cachedMessages && cachedMessages.length > 0) {
            const total = await Message.count({
                where: { conversation_id: conversationId },
            });
            return {
                messages: cachedMessages,
                pagination: {
                    page: 1,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasMore: cachedMessages.length >= limit,
                },
            };
        }
    }
    const total = await Message.count({
        where: { conversation_id: conversationId },
    });
    const totalPages = Math.ceil(total / limit);
    if (before) {
        const beforeMsg = await Message.findByPk(before);
        if (!beforeMsg || beforeMsg.conversation_id !== conversationId) {
            throw new Error("Invalid 'before' message id");
        }
        const olderMessages = await Message.findAll({
            where: {
                conversation_id: conversationId,
                [Op.or]: [
                    { createdAt: { [Op.lt]: beforeMsg.createdAt } },
                    {
                        createdAt: beforeMsg.createdAt,
                        id: { [Op.lt]: beforeMsg.id },
                    },
                ],
            },
            order: [
                ["createdAt", "ASC"],
                ["id", "ASC"],
            ],
            limit,
        });
        const messageResponses = await attachMessagesData(olderMessages);
        let hasMore = false;
        if (messageResponses.length > 0) {
            const firstMsg = olderMessages[0];
            const olderCount = await Message.count({
                where: {
                    conversation_id: conversationId,
                    [Op.or]: [
                        { createdAt: { [Op.lt]: firstMsg.createdAt } },
                        {
                            createdAt: firstMsg.createdAt,
                            id: { [Op.lt]: firstMsg.id },
                        },
                    ],
                },
            });
            hasMore = olderCount > 0;
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
    const allMessages = await Message.findAll({
        where: { conversation_id: conversationId },
        order: [
            ["createdAt", "ASC"],
            ["id", "ASC"],
        ],
    });
    const startIndex = Math.max(0, total - page * limit);
    const endIndex = total - (page - 1) * limit;
    const paginatedMessages = allMessages.slice(startIndex, endIndex);
    const messageResponses = await attachMessagesData(paginatedMessages);
    if (page === 1) {
        await cacheRecentMessages(conversationId, messageResponses).catch(() => {
        });
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
export const sendMessageAndStreamResponse = async (conversationId, userId, content, onChunk, onUserMessageCreated, attachments, metadata, enhancedSystemPrompt) => {
    if (!content || content.trim().length === 0) {
        throw new Error("Message content cannot be empty");
    }
    const conversation = await Conversation.findOne({
        where: { id: conversationId, deleted_at: null },
    });
    if (!conversation)
        throw new Error("Conversation not found");
    if (conversation.user_id !== userId)
        throw new Error("Unauthorized access to conversation");
    const userTokens = estimateTokenCount(content);
    const userMessage = await Message.create({
        conversation_id: conversationId,
        role: "user",
        content: content.trim(),
        tokens_used: userTokens,
        model: conversation.model,
    });
    if (attachments && attachments.length > 0) {
        try {
            const { default: fileUploadModel } = await import("../models/fileUpload.model.js");
            const publicIds = attachments.map((att) => att.public_id);
            await fileUploadModel.updateMessageId(publicIds, userMessage.id);
        }
        catch (err) {
        }
    }
    await invalidateCachePattern(messageHistoryPattern(conversationId));
    await invalidateCachePattern(contextPattern(conversationId));
    try {
        if (onUserMessageCreated) {
            let messageAttachments;
            if (attachments && attachments.length > 0) {
                try {
                    const { default: fileUploadModel } = await import("../models/fileUpload.model.js");
                    const fetchedAttachments = await fileUploadModel.findByMessageId(userMessage.id);
                    if (fetchedAttachments && fetchedAttachments.length > 0) {
                        messageAttachments = fetchedAttachments.map((att) => ({
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
                            openai_file_id: att.openai_file_id,
                        }));
                    }
                }
                catch (err) {
                }
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
    }
    catch (err) {
    }
    conversation.total_tokens_used += userTokens;
    conversation.message_count += 1;
    conversation.set("updatedAt", new Date());
    await conversation.save();
    await invalidateCachePattern(conversationListPattern(conversation.user_id));
    generateAndStoreEmbedding(userMessage.id, userMessage.content).catch(() => {
    });
    const baseSystemPrompt = "You are a helpful AI assistant. Provide clear, accurate, and helpful responses. IMPORTANT: When providing code in your responses, ALWAYS wrap it in markdown code blocks with triple backticks (```) and the language identifier (e.g., ```cpp for C++, ```python for Python, ```javascript for JavaScript). Never provide raw code without proper markdown formatting.";
    const systemPrompt = enhancedSystemPrompt || (await buildSystemPromptWithPreferences(userId, baseSystemPrompt));
    const disableContext = String(process.env.DISABLE_CONTEXT || "false").toLowerCase() === "true";
    const useSemanticContext = String(process.env.USE_SEMANTIC_CONTEXT || "false").toLowerCase() === "true";
    let contextMessages;
    if (disableContext) {
        contextMessages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: content.trim() },
        ];
    }
    else if (useSemanticContext) {
        try {
            const enhancedContext = await buildEnhancedContext(conversationId, content.trim(), {
                recentLimit: Math.min(conversation.context_window, 15),
                semanticLimit: 5,
                maxTokens: 4000,
                systemPrompt,
                useSemanticSearch: true,
            });
            contextMessages = enhancedContext;
        }
        catch {
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
            contextMessages.push(...recentMessagesChron.map((m) => ({
                role: m.role,
                content: m.content,
            })));
        }
    }
    else {
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
        contextMessages.push(...recentMessagesChron.map((m) => ({
            role: m.role,
            content: m.content,
        })));
    }
    if (metadata && (metadata.resendMessageId || metadata.editMessageId)) {
        try {
            const targetMessageId = metadata.resendMessageId || metadata.editMessageId;
            const targetMessage = await Message.findOne({
                where: { id: targetMessageId, conversation_id: conversationId },
            });
            if (targetMessage) {
                const targetTime = new Date(targetMessage.createdAt).getTime();
                const aiMessages = await Message.findAll({
                    where: {
                        conversation_id: conversationId,
                        role: "assistant",
                    },
                    order: [["createdAt", "ASC"]],
                });
                const aiBefore = aiMessages
                    .filter((msg) => new Date(msg.createdAt).getTime() < targetTime)
                    .pop();
                const aiAfter = aiMessages.find((msg) => new Date(msg.createdAt).getTime() > targetTime);
                let contextPrompt = "";
                if (metadata.resendMessageId) {
                    contextPrompt =
                        "[User is resending a previous message because they want a better or different response]\n\n";
                }
                else if (metadata.editMessageId) {
                    contextPrompt = "[User edited their previous message and wants a new response]\n\n";
                }
                if (aiBefore) {
                    contextPrompt += `Previous AI response:\n${aiBefore.content}\n\n`;
                }
                if (metadata.editMessageId && metadata.originalContent) {
                    contextPrompt += `User's original message:\n${metadata.originalContent}\n\n`;
                    contextPrompt += `User's edited message:\n${content}\n\n`;
                }
                else {
                    contextPrompt += `User's message (resent):\n${content}\n\n`;
                }
                if (aiAfter) {
                    contextPrompt += `Your previous response to this:\n${aiAfter.content}\n\n`;
                }
                if (metadata.resendMessageId) {
                    contextPrompt += `Please provide an improved or alternative response to the user's message.`;
                }
                else {
                    contextPrompt += `Please provide a response to the user's edited message.`;
                }
                if (contextMessages.length > 0) {
                    const lastMessage = contextMessages[contextMessages.length - 1];
                    if (lastMessage.role === "user") {
                        lastMessage.content = contextPrompt;
                    }
                }
            }
        }
        catch (err) {
        }
    }
    let modelToUse = conversation.model;
    if (attachments && attachments.length > 0) {
        const { buildMessageContentWithAttachments } = await import("./openai.service.js");
        modelToUse = "gpt-4o";
        const enhancedContent = buildMessageContentWithAttachments(content.trim(), attachments);
        if (contextMessages.length > 0) {
            const lastMessage = contextMessages[contextMessages.length - 1];
            if (lastMessage.role === "user") {
                lastMessage.content = enhancedContent;
            }
        }
    }
    const payload = {
        model: modelToUse,
        messages: contextMessages,
        stream: true,
        max_completion_tokens: 2000,
    };
    if (!["gpt-5-nano"].includes(conversation.model)) {
        payload.temperature = 0.7;
    }
    const openai = (await import("./openai.service.js")).default;
    let stream;
    try {
        stream = await openai.chat.completions.create(payload);
    }
    catch (error) {
        throw error;
    }
    let fullContent = "";
    try {
        const groupSize = 2;
        let buffer = "";
        let chunkCount = 0;
        for await (const chunk of stream) {
            chunkCount++;
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
                const text = delta.content;
                fullContent += text;
                buffer += text;
                const groupRegex = new RegExp(`^(\\s*\\S+(?:\\s+\\S+){${groupSize - 1}})`);
                let match = buffer.match(groupRegex);
                while (match) {
                    const piece = match[1];
                    try {
                        await onChunk(piece);
                    }
                    catch (e) {
                    }
                    buffer = buffer.slice(match[0].length);
                    match = buffer.match(groupRegex);
                }
            }
        }
        if (buffer.length > 0) {
            try {
                await onChunk(buffer);
            }
            catch (e) {
            }
            buffer = "";
        }
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
        conversation.set("updatedAt", new Date());
        await conversation.save();
        await invalidateCachePattern(messageHistoryPattern(conversationId));
        await invalidateCachePattern(contextPattern(conversationId));
        await invalidateCachePattern(conversationListPattern(conversation.user_id));
        generateAndStoreEmbedding(assistantMessage.id, assistantMessage.content).catch((error) => {
        });
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
        throw new Error(err?.message || "Streaming failed");
    }
};
export const deleteMessage = async (messageId, userId) => {
    const message = await Message.findByPk(messageId);
    if (!message) {
        throw new Error("Message not found");
    }
    const conversation = await Conversation.findByPk(message.conversation_id);
    if (!conversation) {
        throw new Error("Conversation not found");
    }
    if (conversation.user_id !== userId) {
        throw new Error("Unauthorized access to message");
    }
    await message.destroy();
    conversation.message_count = Math.max(0, conversation.message_count - 1);
    conversation.total_tokens_used = Math.max(0, conversation.total_tokens_used - message.tokens_used);
    conversation.set("updatedAt", new Date());
    await conversation.save();
    return {
        message: "Message deleted successfully",
    };
};
