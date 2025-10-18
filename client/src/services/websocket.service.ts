/**
 * WebSocket Service
 * Real-time communication service using Socket.io
 * Handles authentication, auto-reconnection, and multi-tab synchronization
 */

import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../utils/token.util";
import type { Message, ConversationListItem } from "../types/chat.type";

// Server events interface
interface ServerToClientEvents {
  // Connection events
  "conversation:joined": (data: { conversationId: string }) => void;
  "conversation:left": (data: { conversationId: string }) => void;
  error: (data: { message: string; type?: string }) => void;
  pong: () => void;

  // Message events
  "message:chunk": (data: {
    conversationId: string;
    chunk: string;
    content: string;
  }) => void;
  "message:complete": (data: {
    userMessage: Message;
    assistantMessage: Message;
    conversation?: {
      id: string;
      total_tokens_used: number;
      message_count: number;
    };
  }) => void;
  // Notification for a newly created/sent message (other sockets should render it)
  "message:new": (data: { conversationId: string; message: Message }) => void;

  // Typing events
  "ai:typing:start": (data: { conversationId: string }) => void;
  "ai:typing:stop": (data: { conversationId: string }) => void;
  "user:typing:start": (data: {
    userId: string;
    conversationId: string;
  }) => void;
  "user:typing:stop": (data: {
    userId: string;
    conversationId: string;
  }) => void;

  // Conversation events (multi-tab sync)
  "conversation:created": (conversation: ConversationListItem) => void;
  "conversation:updated": (data: {
    conversationId: string;
    update: Partial<ConversationListItem>;
  }) => void;
  "conversation:deleted": (data: { conversationId: string }) => void;
  // New event for conversation activity (for list refresh)
  "conversation:activity": (data: {
    conversationId: string;
    lastActivity: string;
    messageCount: number;
    totalTokens: number;
  }) => void;

  // Follow-up suggestion events
  followups_response: (data: {
    messageId: string;
    suggestions: string[];
  }) => void;
  followups_error: (data: { messageId: string; error: string }) => void;
}

// Client events interface
interface ClientToServerEvents {
  // Connection events
  "join:conversation": (conversationId: string) => void;
  "leave:conversation": (conversationId: string) => void;
  ping: () => void;

  // Message events
  "message:send": (data: {
    conversationId: string;
    content: string;
    messageId?: string;
  }) => void;

  // Typing events
  "typing:start": (conversationId: string) => void;
  "typing:stop": (conversationId: string) => void;

  // Follow-up suggestion events
  request_followups: (data: {
    messageId: string;
    lastUserMessage: string;
    lastBotMessage: string;
    sessionId: string;
  }) => void;

  // Conversation events (multi-tab sync)
  "conversation:create": (conversation: ConversationListItem) => void;
  "conversation:update": (data: {
    conversationId: string;
    update: Partial<ConversationListItem>;
  }) => void;
  "conversation:delete": (conversationId: string) => void;
}

export type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface WebSocketEventHandlers {
  // Message handlers
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

  // Typing handlers
  onAITypingStart?: (data: { conversationId: string }) => void;
  onAITypingStop?: (data: { conversationId: string }) => void;
  onUserTypingStart?: (data: {
    userId: string;
    conversationId: string;
  }) => void;
  onUserTypingStop?: (data: { userId: string; conversationId: string }) => void;

  // Conversation handlers (multi-tab sync)
  onConversationCreated?: (conversation: ConversationListItem) => void;
  onConversationUpdated?: (data: {
    conversationId: string;
    update: Partial<ConversationListItem>;
  }) => void;
  onConversationDeleted?: (data: { conversationId: string }) => void;
  // New message notification handler (other sockets sending)
  onMessageNew?: (data: { conversationId: string; message: Message }) => void;
  // New conversation activity handler (for conversation list refresh)
  onConversationActivity?: (data: {
    conversationId: string;
    lastActivity: string;
    messageCount: number;
    totalTokens: number;
  }) => void;

  // Follow-up suggestion handlers
  onFollowupsResponse?: (data: {
    messageId: string;
    suggestions: string[];
  }) => void;
  onFollowupsError?: (data: { messageId: string; error: string }) => void;

  // Connection handlers
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onReconnect?: () => void;
  onError?: (error: { message: string; type?: string }) => void;
}

class WebSocketService {
  private socket: SocketType | null = null;
  private handlers: WebSocketEventHandlers = {};
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private currentConversationId: string | null = null;
  private connectionPromise: Promise<void> | null = null;
  private wasDisconnected = false;

  constructor() {
    // Don't auto-connect in constructor to avoid issues
    // Connection will be handled by useWebSocket hook
  }

  /**
   * Connect to WebSocket server with authentication
   */
  async connect(): Promise<void> {
    if (this.socket?.connected || this.isConnecting) {
      return this.connectionPromise || Promise.resolve();
    }

    this.isConnecting = true;

    this.connectionPromise = new Promise((resolve, reject) => {
      const token = getAccessToken();

      if (!token) {
        this.isConnecting = false;
        reject(new Error("No authentication token available"));
        return;
      }

      // console.log("[WebSocket] Connecting to server...");

      this.socket = io(
        import.meta.env.VITE_API_URL || "http://localhost:3000",
        {
          auth: {
            token,
          },
          transports: ["websocket", "polling"],
          timeout: 20000,
          autoConnect: false,
        }
      );

      // Connection events
      this.socket.on("connect", () => {
        // console.log("[WebSocket] Connected successfully");

        if (this.wasDisconnected) {
          // console.log("[WebSocket] Reconnected");
          this.handlers.onReconnect?.();

          // Rejoin current conversation if any
          if (this.currentConversationId) {
            this.joinConversation(this.currentConversationId);
          }
          this.wasDisconnected = false;
        }

        this.isConnecting = false;
        this.clearReconnectTimer();
        this.handlers.onConnect?.();
        resolve();
      });

      this.socket.on("disconnect", (reason) => {
        // console.log("[WebSocket] Disconnected:", reason);
        this.wasDisconnected = true;
        this.handlers.onDisconnect?.(reason);

        // Auto-reconnect if not manually disconnected
        if (reason !== "io client disconnect") {
          this.scheduleReconnect();
        }
      });

      this.socket.on("connect_error", (error) => {
        // console.error("[WebSocket] Connection error:", error.message);
        this.isConnecting = false;

        // If authentication failed, don't auto-reconnect
        if (error.message.includes("Authentication")) {
          this.handlers.onError?.({
            message: error.message,
            type: "auth_error",
          });
          reject(error);
          return;
        }

        this.scheduleReconnect();
        reject(error);
      });

      // Error handling
      this.socket.on("error", (error) => {
        // console.error("[WebSocket] Socket error:", error);
        this.handlers.onError?.(error);
      });

      // Message events
      this.socket.on("message:chunk", (data) => {
        this.handlers.onMessageChunk?.(data);
      });

      this.socket.on("message:complete", (data) => {
        this.handlers.onMessageComplete?.(data);
      });

      // Typing events
      this.socket.on("ai:typing:start", (data) => {
        this.handlers.onAITypingStart?.(data);
      });

      this.socket.on("ai:typing:stop", (data) => {
        this.handlers.onAITypingStop?.(data);
      });

      this.socket.on("user:typing:start", (data) => {
        this.handlers.onUserTypingStart?.(data);
      });

      this.socket.on("user:typing:stop", (data) => {
        this.handlers.onUserTypingStop?.(data);
      });

      // Conversation events (multi-tab sync)
      this.socket.on("conversation:created", (conversation) => {
        this.handlers.onConversationCreated?.(conversation);
      });

      this.socket.on("conversation:updated", (data) => {
        this.handlers.onConversationUpdated?.(data);
      });

      this.socket.on("conversation:deleted", (data) => {
        this.handlers.onConversationDeleted?.(data);
      });

      // New message notification (sent by other sockets)
      this.socket.on("message:new", (data) => {
        try {
          // Allow handlers to process new message
          this.handlers.onMessageNew?.(data);
        } catch (err) {
          console.debug("websocket: onMessageNew handler error", err);
        }
        try {
          window.dispatchEvent(
            new CustomEvent("message:new", { detail: data })
          );
        } catch (err) {
          console.debug("websocket: dispatch message:new failed", err);
        }
      });

      // Conversation activity notification (for refreshing conversation list)
      this.socket.on("conversation:activity", (data) => {
        try {
          // Allow handlers to process activity
          this.handlers.onConversationActivity?.(data);
        } catch (err) {
          console.debug("websocket: onConversationActivity handler error", err);
        }
        try {
          // Dispatch global event for conversation list refresh
          window.dispatchEvent(
            new CustomEvent("conversation:activity", { detail: data })
          );
        } catch (err) {
          console.debug(
            "websocket: dispatch conversation:activity failed",
            err
          );
        }
      });

      // Follow-up suggestion events
      this.socket.on("followups_response", (data) => {
        try {
          this.handlers.onFollowupsResponse?.(data);
        } catch (err) {
          console.debug("websocket: onFollowupsResponse handler error", err);
        }
      });

      this.socket.on("followups_error", (data) => {
        try {
          this.handlers.onFollowupsError?.(data);
        } catch (err) {
          console.debug("websocket: onFollowupsError handler error", err);
        }
      });

      // Start connection
      this.socket.connect();

      // Connection timeout
      setTimeout(() => {
        if (this.isConnecting) {
          this.isConnecting = false;
          reject(new Error("Connection timeout"));
        }
      }, 20000);
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    // console.log("[WebSocket] Manually disconnecting...");
    this.clearReconnectTimer();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentConversationId = null;
    this.connectionPromise = null;
    this.wasDisconnected = false;
  }

  /**
   * Set event handlers
   */
  setHandlers(handlers: WebSocketEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      // console.warn("[WebSocket] Cannot join conversation: not connected");
      return;
    }

    // console.log(`[WebSocket] Joining conversation: ${conversationId}`);
    this.currentConversationId = conversationId;
    this.socket.emit("join:conversation", conversationId);
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) return;

    // console.log(`[WebSocket] Leaving conversation: ${conversationId}`);
    this.socket.emit("leave:conversation", conversationId);

    if (this.currentConversationId === conversationId) {
      this.currentConversationId = null;
    }
  }

  /**
   * Send a message through WebSocket
   */
  sendMessage(conversationId: string, content: string): void {
    if (!this.socket?.connected) {
      throw new Error("WebSocket not connected");
    }

    // console.log(`[WebSocket] Sending message to conversation: ${conversationId}`);
    this.socket.emit("message:send", { conversationId, content });
  }

  sendMessageWithId(
    conversationId: string,
    content: string,
    messageId?: string
  ): void {
    if (!this.socket?.connected) {
      throw new Error("WebSocket not connected");
    }
    this.socket.emit("message:send", { conversationId, content, messageId });
  }

  /**
   * Send typing start event
   */
  startTyping(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit("typing:start", conversationId);
  }

  /**
   * Send typing stop event
   */
  stopTyping(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit("typing:stop", conversationId);
  }

  /**
   * Notify about conversation creation (for multi-tab sync)
   */
  notifyConversationCreated(conversation: ConversationListItem): void {
    if (!this.socket?.connected) return;
    this.socket.emit("conversation:create", conversation);
  }

  /**
   * Notify about conversation update (for multi-tab sync)
   */
  notifyConversationUpdated(
    conversationId: string,
    update: Partial<ConversationListItem>
  ): void {
    if (!this.socket?.connected) return;
    this.socket.emit("conversation:update", { conversationId, update });
  }

  /**
   * Notify about conversation deletion (for multi-tab sync)
   */
  notifyConversationDeleted(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit("conversation:delete", conversationId);
  }

  /**
   * Send ping to test connection
   */
  ping(): void {
    if (!this.socket?.connected) return;
    this.socket.emit("ping");
  }

  /**
   * Request follow-up suggestions for a message
   */
  requestFollowups(
    messageId: string,
    lastUserMessage: string,
    lastBotMessage: string,
    sessionId: string
  ): void {
    if (!this.socket?.connected) {
      throw new Error("WebSocket not connected");
    }
    this.socket.emit("request_followups", {
      messageId,
      lastUserMessage,
      lastBotMessage,
      sessionId,
    });
  }

  /**
   * Schedule auto-reconnect
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const delay = 3000; // 3 seconds
    // console.log(`[WebSocket] Scheduling reconnect in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      if (!this.socket?.connected) {
        // console.log("[WebSocket] Attempting auto-reconnect...");
        this.connect().catch(() => {
          // console.error("[WebSocket] Auto-reconnect failed:", /* error message suppressed */);
        });
      }
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Update authentication token and reconnect
   */
  updateToken(): void {
    if (this.socket?.connected) {
      // Disconnect and reconnect with new token
      this.disconnect();
      setTimeout(() => {
        this.connect().catch(() => {
          // reconnect with new token failed (log suppressed)
        });
      }, 100);
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

export default websocketService;
