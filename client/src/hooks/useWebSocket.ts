/**
 * useWebSocket Hook
 * Manages WebSocket connections and real-time events for chat functionality
 */

import { useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "./useAuth";
import {
  websocketService,
  type WebSocketEventHandlers,
} from "../services/websocket.service";
import type { Message, ConversationListItem } from "../types/chat.type";

interface UseWebSocketOptions {
  enabled?: boolean;
  onMessageChunk?: (data: {
    conversationId: string;
    chunk: string;
    content: string;
  }) => void;
  onMessageComplete?: (data: {
    userMessage: Message;
    assistantMessage: Message;
    conversation?: {
      id: string;
      total_tokens_used: number;
      message_count: number;
    };
  }) => void;
  onMessageStateUpdate?: (data: {
    conversationId: string;
    messageId?: string;
    status: "complete" | "failed";
  }) => void;
  onAITypingStart?: (data: { conversationId: string }) => void;
  onAITypingStop?: (data: { conversationId: string }) => void;
  onConversationCreated?: (conversation: ConversationListItem) => void;
  onConversationUpdated?: (data: {
    conversationId: string;
    update: Partial<ConversationListItem>;
  }) => void;
  onConversationDeleted?: (data: { conversationId: string }) => void;
  onMessageNew?: (data: { conversationId: string; message: Message }) => void;
  onConversationActivity?: (data: {
    conversationId: string;
    lastActivity: string;
    messageCount: number;
    totalTokens: number;
  }) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    attachments?: Array<{
      public_id: string;
      secure_url: string;
      resource_type: string;
      format?: string;
      extracted_text?: string;
    }>
  ) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  notifyConversationCreated: (conversation: ConversationListItem) => void;
  notifyConversationUpdated: (
    conversationId: string,
    update: Partial<ConversationListItem>
  ) => void;
  notifyConversationDeleted: (conversationId: string) => void;
}

export const useWebSocket = (
  options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
  const { enabled = true, ...handlers } = options;
  const { isAuthenticated, logout } = useAuth();
  const handlersRef = useRef(handlers);

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // WebSocket event handlers - stable reference to prevent infinite loops
  const eventHandlers: WebSocketEventHandlers = useMemo(
    () => ({
      onConnect: () => {
        // connect log removed
      },

      onDisconnect: (/* reason */) => {
        // disconnect log removed
      },

      onReconnect: () => {
        // reconnect log removed
      },

      onError: (error) => {
        // error logging removed

        // If authentication error, logout user
        if (error.type === "auth_error") {
          logout();
        }
      },

      onMessageChunk: (data) => {
        handlersRef.current.onMessageChunk?.(data);
      },

      onMessageComplete: (data) => {
        handlersRef.current.onMessageComplete?.(data);
      },

      onMessageStateUpdate: (data) => {
        handlersRef.current.onMessageStateUpdate?.(data);
      },

      onAITypingStart: (data) => {
        handlersRef.current.onAITypingStart?.(data);
      },

      onAITypingStop: (data) => {
        handlersRef.current.onAITypingStop?.(data);
      },

      onConversationCreated: (conversation) => {
        handlersRef.current.onConversationCreated?.(conversation);
      },

      onConversationUpdated: (data) => {
        handlersRef.current.onConversationUpdated?.(data);
      },

      onConversationDeleted: (data) => {
        handlersRef.current.onConversationDeleted?.(data);
      },

      onConversationActivity: (data) => {
        handlersRef.current.onConversationActivity?.(data);
      },
    }),
    [logout]
  );

  // Set up WebSocket event handlers
  useEffect(() => {
    if (!enabled) return;

    websocketService.setHandlers(eventHandlers);

    // Connect if authenticated
    if (isAuthenticated) {
      websocketService.connect().catch(() => {
        // connect failure logging removed
      });
    }

    return () => {
      // Clean up handlers but don't disconnect (other components might use it)
      websocketService.setHandlers({});
    };
  }, [enabled, isAuthenticated, eventHandlers]);

  // Disconnect when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      websocketService.disconnect();
    }
  }, [isAuthenticated]);

  // WebSocket methods
  const connect = useCallback(async () => {
    return websocketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    websocketService.joinConversation(conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    websocketService.leaveConversation(conversationId);
  }, []);

  const sendMessage = useCallback(
    (
      conversationId: string,
      content: string,
      attachments?: Array<{
        public_id: string;
        secure_url: string;
        resource_type: string;
        format?: string;
        extracted_text?: string;
      }>
    ) => {
      websocketService.sendMessage(conversationId, content, attachments);
    },
    []
  );

  const startTyping = useCallback((conversationId: string) => {
    websocketService.startTyping(conversationId);
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    websocketService.stopTyping(conversationId);
  }, []);

  const notifyConversationCreated = useCallback(
    (conversation: ConversationListItem) => {
      websocketService.notifyConversationCreated(conversation);
    },
    []
  );

  const notifyConversationUpdated = useCallback(
    (conversationId: string, update: Partial<ConversationListItem>) => {
      websocketService.notifyConversationUpdated(conversationId, update);
    },
    []
  );

  const notifyConversationDeleted = useCallback((conversationId: string) => {
    websocketService.notifyConversationDeleted(conversationId);
  }, []);

  return {
    isConnected: websocketService.isConnected(),
    connect,
    disconnect,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    notifyConversationCreated,
    notifyConversationUpdated,
    notifyConversationDeleted,
  };
};

export default useWebSocket;
