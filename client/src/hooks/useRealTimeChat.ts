/**
 * useRealTimeChat Hook
 * Manages real-time chat functionality with WebSocket integration
 * Simplified version that integrates with existing ChatPage structure
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { App } from "antd";
import { useWebSocket } from "./useWebSocket";
import type {
  Message,
  Conversation,
  ConversationListItem,
} from "../types/chat.type";

interface UseRealTimeChatOptions {
  conversation: Conversation | null;
  onConversationUpdate?: (conversation: Partial<Conversation>) => void;
}

interface UseRealTimeChatReturn {
  isConnected: boolean;
  isAITyping: boolean;
  sendMessage: (
    content: string,
    attachments?: Array<{
      public_id: string;
      secure_url: string;
      resource_type: string;
      format?: string;
      extracted_text?: string;
    }>
  ) => Promise<void>;
  isSending: boolean;
  startTyping: () => void;
  stopTyping: () => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
}

export const useRealTimeChat = (
  options: UseRealTimeChatOptions
): UseRealTimeChatReturn => {
  const { conversation, onConversationUpdate } = options;
  const { message: antdMessage } = App.useApp();

  // State
  const [isAITyping, setIsAITyping] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMessageIdRef = useRef<string | null>(null);
  const pendingClearTimeoutRef = useRef<number | null>(null);

  // lightweight message id generator (avoid adding uuid dependency)
  const createMessageId = () =>
    `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // WebSocket integration with typed handlers
  const websocket = useWebSocket({
    // Message chunk handler
    onMessageChunk: useCallback(
      (data: { conversationId: string; chunk: string; content: string }) => {
        if (data.conversationId !== conversation?.id) return;
        // chunk received - event dispatched
        window.dispatchEvent(
          new CustomEvent("message:chunk", { detail: data })
        );
      },
      [conversation?.id]
    ),

    // Message complete handler
    onMessageComplete: useCallback(
      (data: {
        userMessage: Message;
        assistantMessage: Message;
        conversation?: {
          id: string;
          total_tokens_used: number;
          message_count: number;
        };
        messageId?: string;
      }) => {
        // Only process conversation updates if it's the current conversation
        if (data.userMessage.conversation_id !== conversation?.id) {
          // Still dispatch event for other components to handle
          window.dispatchEvent(
            new CustomEvent("message:complete", { detail: data })
          );
          return;
        }

        // Clear both typing and sending flags for the conversation.
        // If messageId is provided, only clear the pendingMessageIdRef when it matches.
        setIsAITyping(false);
        setIsSending(false);
        if (data.messageId && pendingMessageIdRef.current === data.messageId) {
          pendingMessageIdRef.current = null;
        }
        // Clear any pending safety timeout
        if (pendingClearTimeoutRef.current) {
          window.clearTimeout(pendingClearTimeoutRef.current as number);
          pendingClearTimeoutRef.current = null;
        }

        if (data.conversation && onConversationUpdate) {
          onConversationUpdate({
            total_tokens_used: data.conversation.total_tokens_used,
            message_count: data.conversation.message_count,
            updatedAt: new Date().toISOString(),
          });
        }

        // Dispatch event for parent component
        window.dispatchEvent(
          new CustomEvent("message:complete", { detail: data })
        );
      },
      [conversation?.id, onConversationUpdate]
    ),

    // AI typing handlers
    onAITypingStart: useCallback(
      (data: { conversationId: string; messageId?: string }) => {
        if (data.conversationId !== conversation?.id) return;

        // Mark global typing state for this conversation so all tabs' inputs
        // are disabled while the AI is streaming.
        setIsAITyping(true);

        // Dispatch event to ChatPage to add typing message in chat for all tabs
        window.dispatchEvent(
          new CustomEvent("ai:typing:start", { detail: data })
        );
      },
      [conversation?.id]
    ),

    onAITypingStop: useCallback(
      (data: { conversationId: string; messageId?: string }) => {
        if (data.conversationId !== conversation?.id) return;

        // Clear global typing state for this conversation so all tabs' inputs
        // are re-enabled once streaming stops.
        setIsAITyping(false);

        // Dispatch event to ChatPage to remove typing messages
        window.dispatchEvent(
          new CustomEvent("ai:typing:stop", { detail: data })
        );
      },
      [conversation?.id]
    ),

    // Multi-tab sync handlers
    onConversationCreated: useCallback(
      (conversationData: ConversationListItem) => {
        window.dispatchEvent(
          new CustomEvent("conversation:created", { detail: conversationData })
        );
        // Force conversation list refresh
        window.dispatchEvent(new Event("conversations:refresh"));
      },
      []
    ),

    onConversationUpdated: useCallback(
      (data: {
        conversationId: string;
        update: Partial<ConversationListItem>;
      }) => {
        if (data.conversationId === conversation?.id && onConversationUpdate) {
          onConversationUpdate(data.update);
        }
        window.dispatchEvent(
          new CustomEvent("conversation:updated", { detail: data })
        );
        // Force conversation list refresh
        window.dispatchEvent(new Event("conversations:refresh"));
      },
      [conversation?.id, onConversationUpdate]
    ),

    onConversationDeleted: useCallback((data: { conversationId: string }) => {
      window.dispatchEvent(
        new CustomEvent("conversation:deleted", { detail: data })
      );
      // Force conversation list refresh
      window.dispatchEvent(new Event("conversations:refresh"));
    }, []),

    // Conversation activity handler for conversation list refresh
    onConversationActivity: useCallback(
      (data: {
        conversationId: string;
        lastActivity: string;
        messageCount: number;
        totalTokens: number;
      }) => {
        // Force refresh conversation list to update ordering and metadata
        window.dispatchEvent(new Event("conversations:refresh"));

        // Dispatch activity event for other components
        window.dispatchEvent(
          new CustomEvent("conversation:activity", { detail: data })
        );
      },
      []
    ),

    // New message notification from other sockets
    onMessageNew: useCallback(
      (data: { conversationId: string; message: Message }) => {
        // If the new message belongs to current conversation, dispatch to update messages
        if (data.conversationId === conversation?.id) {
          window.dispatchEvent(
            new CustomEvent("message:new", { detail: data })
          );
        } else {
          // For other conversations, we may want to refresh sidebar ordering
          try {
            window.dispatchEvent(
              new CustomEvent("conversation:activity", {
                detail: { conversationId: data.conversationId },
              })
            );
          } catch {
            // logging removed
          }
        }
      },
      [conversation?.id]
    ),
  });

  // Send message function using WebSocket
  const sendMessage = useCallback(
    async (
      content: string,
      attachments?: Array<{
        public_id: string;
        secure_url: string;
        resource_type: string;
        format?: string;
        extracted_text?: string;
      }>
    ): Promise<void> => {
      if (!conversation || !websocket.isConnected || isSending) {
        antdMessage.warning(
          "Cannot send message. Please check your connection."
        );
        return;
      }

      try {
        setIsSending(true);
        setIsAITyping(true);

        // Generate a messageId for sequence tracking
        const messageId = createMessageId();
        pendingMessageIdRef.current = messageId;

        // Clear any existing safety timeout
        if (pendingClearTimeoutRef.current) {
          window.clearTimeout(
            pendingClearTimeoutRef.current as unknown as number
          );
          pendingClearTimeoutRef.current = null;
        }

        // Safety timeout: clear sending state after 8s if no matching complete arrives
        pendingClearTimeoutRef.current = window.setTimeout(() => {
          if (pendingMessageIdRef.current === messageId) {
            pendingMessageIdRef.current = null;
            setIsSending(false);
            setIsAITyping(false);
          }
          pendingClearTimeoutRef.current = null;
        }, 8000) as unknown as number;

        // Send via WebSocket with attachments
        websocket.sendMessage(conversation.id, content, attachments);

        // Dispatch event for optimistic UI update
        window.dispatchEvent(
          new CustomEvent("message:send", {
            detail: {
              conversationId: conversation.id,
              content,
              messageId: pendingMessageIdRef.current,
              attachments,
            },
          })
        );
      } catch (error) {
        console.error("[useRealTimeChat] Failed to send message:", error);
        setIsSending(false);
        setIsAITyping(false);
        antdMessage.error("Failed to send message. Please try again.");
        throw error;
      }
    },
    [conversation, websocket, isSending, antdMessage]
  );

  // Typing indicators
  const startTyping = useCallback(() => {
    if (!conversation?.id || !websocket.isConnected) return;

    websocket.startTyping(conversation.id);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, websocket]);

  const stopTyping = useCallback(() => {
    if (!conversation?.id || !websocket.isConnected) return;

    websocket.stopTyping(conversation.id);

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [conversation?.id, websocket]);

  // Join/leave conversation methods
  const joinConversation = useCallback(
    (conversationId: string) => {
      websocket.joinConversation(conversationId);
    },
    [websocket]
  );

  const leaveConversation = useCallback(
    (conversationId: string) => {
      websocket.leaveConversation(conversationId);
    },
    [websocket]
  );

  // Auto join/leave conversation when it changes
  useEffect(() => {
    if (!websocket.isConnected || !conversation?.id) return;

    joinConversation(conversation.id);

    return () => {
      leaveConversation(conversation.id);
    };
  }, [
    conversation?.id,
    websocket.isConnected,
    joinConversation,
    leaveConversation,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected: websocket.isConnected,
    isAITyping,
    sendMessage,
    isSending,
    startTyping,
    stopTyping,
    joinConversation,
    leaveConversation,
  };
};

export default useRealTimeChat;
