import Message from "../models/message.model.js";
import { getRelevantMessagesForContext } from "./semantic-search.service.js";
import { estimateTokenCount } from "./openai.service.js";
export async function buildEnhancedContext(conversationId, currentMessageContent, options = {}) {
    const { recentLimit = 10, semanticLimit = 5, maxTokens = 4000, systemPrompt, useSemanticSearch = true, } = options;
    const contextMessages = [];
    let totalTokens = 0;
    if (systemPrompt) {
        contextMessages.push({
            role: "system",
            content: systemPrompt,
        });
        totalTokens += estimateTokenCount(systemPrompt);
    }
    const recentMessages = await Message.findAll({
        where: { conversation_id: conversationId },
        order: [["createdAt", "DESC"]],
        limit: recentLimit,
    });
    const recentMessagesChron = recentMessages.reverse();
    let semanticMessages = [];
    if (useSemanticSearch) {
        try {
            semanticMessages = await getRelevantMessagesForContext(conversationId, currentMessageContent, semanticLimit);
        }
        catch (error) {
        }
    }
    const messageMap = new Map();
    for (const msg of recentMessagesChron) {
        messageMap.set(msg.id, {
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
        });
    }
    for (const msg of semanticMessages) {
        if (!messageMap.has(msg.message_id)) {
            messageMap.set(msg.message_id, {
                role: msg.role,
                content: msg.content,
                createdAt: msg.createdAt,
            });
        }
    }
    const allMessages = Array.from(messageMap.values()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const messagesToAdd = [];
    for (const message of allMessages) {
        const messageTokens = estimateTokenCount(message.content);
        if (totalTokens + messageTokens > maxTokens) {
            break;
        }
        messagesToAdd.push({
            role: message.role,
            content: message.content,
        });
        totalTokens += messageTokens;
    }
    if (messagesToAdd.length < recentMessagesChron.length) {
        messagesToAdd.length = 0;
        let recentTokens = systemPrompt ? estimateTokenCount(systemPrompt) : 0;
        for (let i = recentMessagesChron.length - 1; i >= 0; i--) {
            const msg = recentMessagesChron[i];
            const messageTokens = estimateTokenCount(msg.content);
            if (recentTokens + messageTokens > maxTokens) {
                break;
            }
            messagesToAdd.unshift({
                role: msg.role,
                content: msg.content,
            });
            recentTokens += messageTokens;
        }
    }
    return [...contextMessages, ...messagesToAdd];
}
export async function buildSimpleContext(conversationId, recentLimit = 10, systemPrompt, maxTokens = 4000) {
    return buildEnhancedContext(conversationId, "", {
        recentLimit,
        semanticLimit: 0,
        maxTokens,
        systemPrompt,
        useSemanticSearch: false,
    });
}
export default {
    buildEnhancedContext,
    buildSimpleContext,
};
