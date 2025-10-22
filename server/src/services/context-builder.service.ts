import Message from "../models/message.model.js";
import { getRelevantMessagesForContext } from "./semantic-search.service.js";
import { estimateTokenCount } from "./openai.service.js";

/**
 * Enhanced context builder that combines recent messages with semantically relevant ones
 *
 * Strategy:
 * 1. Get N most recent messages (for conversation flow)
 * 2. Get M semantically relevant messages (for deep context)
 * 3. Remove duplicates (prefer recent messages)
 * 4. Sort chronologically
 * 5. Truncate to fit token limit
 *
 * @param conversationId - Conversation ID
 * @param currentMessageContent - Current user message
 * @param options - Context building options
 * @returns Array of messages formatted for OpenAI API
 */
export async function buildEnhancedContext(
  conversationId: string,
  currentMessageContent: string,
  options: {
    recentLimit?: number; // Number of recent messages (default: 10)
    semanticLimit?: number; // Number of semantic messages (default: 5)
    maxTokens?: number; // Max total tokens (default: 4000)
    systemPrompt?: string; // System prompt to prepend
    useSemanticSearch?: boolean; // Enable semantic search (default: true)
  } = {}
): Promise<Array<{ role: "system" | "user" | "assistant"; content: string }>> {
  const {
    recentLimit = 10,
    semanticLimit = 5,
    maxTokens = 4000,
    systemPrompt,
    useSemanticSearch = true,
  } = options;

  const contextMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [];

  // Add system prompt if provided
  let totalTokens = 0;
  if (systemPrompt) {
    contextMessages.push({
      role: "system",
      content: systemPrompt,
    });
    totalTokens += estimateTokenCount(systemPrompt);
  }

  // Step 1: Get recent messages (most recent conversation flow)
  const recentMessages = await Message.findAll({
    where: { conversation_id: conversationId },
    order: [["createdAt", "DESC"]],
    limit: recentLimit,
  });

  // Reverse to chronological order
  const recentMessagesChron = recentMessages.reverse();

  // Step 2: Get semantically relevant messages (if enabled and API key available)
  let semanticMessages: any[] = [];
  if (useSemanticSearch) {
    try {
      semanticMessages = await getRelevantMessagesForContext(
        conversationId,
        currentMessageContent,
        semanticLimit
      );
    } catch (error: any) {
      // If semantic search fails (e.g., no API key, no embeddings), continue without it
      console.warn("Semantic search unavailable, using recent messages only:", error.message);
    }
  }

  // Step 3: Combine and deduplicate messages
  // Create a Map to track unique messages by ID
  const messageMap = new Map<string, { role: string; content: string; createdAt: Date }>();

  // Add recent messages (these have priority)
  for (const msg of recentMessagesChron) {
    messageMap.set(msg.id, {
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    });
  }

  // Add semantic messages (only if not already in recent)
  for (const msg of semanticMessages) {
    if (!messageMap.has(msg.message_id)) {
      messageMap.set(msg.message_id, {
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      });
    }
  }

  // Step 4: Sort all messages chronologically (oldest to newest)
  const allMessages = Array.from(messageMap.values()).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  // Step 5: Add messages to context until we hit token limit
  // Add from oldest to newest, but if we hit limit, prioritize recent messages
  const messagesToAdd: typeof contextMessages = [];

  for (const message of allMessages) {
    const messageTokens = estimateTokenCount(message.content);

    // Check if adding this message would exceed max tokens
    if (totalTokens + messageTokens > maxTokens) {
      // Token limit reached
      break;
    }

    messagesToAdd.push({
      role: message.role as "user" | "assistant" | "system",
      content: message.content,
    });
    totalTokens += messageTokens;
  }

  // If we couldn't fit all messages, ensure we at least have the most recent ones
  if (messagesToAdd.length < recentMessagesChron.length) {
    // Clear and rebuild with only recent messages
    messagesToAdd.length = 0;
    let recentTokens = systemPrompt ? estimateTokenCount(systemPrompt) : 0;

    // Add recent messages in reverse order (newest first) until we hit limit
    for (let i = recentMessagesChron.length - 1; i >= 0; i--) {
      const msg = recentMessagesChron[i];
      const messageTokens = estimateTokenCount(msg.content);

      if (recentTokens + messageTokens > maxTokens) {
        break;
      }

      messagesToAdd.unshift({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      });
      recentTokens += messageTokens;
    }
  }

  // Combine system prompt with messages
  return [...contextMessages, ...messagesToAdd];
}

/**
 * Simple context builder (backwards compatible)
 * Just gets N recent messages without semantic search
 *
 * @param conversationId - Conversation ID
 * @param recentLimit - Number of recent messages
 * @param systemPrompt - Optional system prompt
 * @param maxTokens - Maximum total tokens
 * @returns Array of messages formatted for OpenAI API
 */
export async function buildSimpleContext(
  conversationId: string,
  recentLimit: number = 10,
  systemPrompt?: string,
  maxTokens: number = 4000
): Promise<Array<{ role: "system" | "user" | "assistant"; content: string }>> {
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
