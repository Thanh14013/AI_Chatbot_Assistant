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
  // State update for sender socket (no duplicate messages)
  "message:state_update": (data: {
    conversationId: string;
    messageId?: string;
    status: "complete" | "failed";
  }) => void;
  // Notification for a newly created/sent message (other sockets should render it)
  "message:new": (data: { conversationId: string; message: Message }) => void;

  // Message pin events (multi-tab sync)
  "message:pinned": (data: {
    conversationId: string;
    messageId: string;
    message?: Message;
  }) => void;
  "message:unpinned": (data: {
    conversationId: string;
    messageId: string;
  }) => void;

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
  "conversation:moved": (data: {
    conversationId: string;
    oldProjectId: string | null;
    newProjectId: string | null;
    conversation?: ConversationListItem;
  }) => void;
  // New event for conversation activity (for list refresh)
  "conversation:activity": (data: {
    conversationId: string;
    lastActivity: string;
    messageCount: number;
    totalTokens: number;
  }) => void;
  // New event for unread status (multi-tab unread tracking)
  "conversation:unread_status": (data: {
    conversationId: string;
    hasUnread: boolean;
    socketId?: string;
  }) => void;

  // Project events (realtime CRUD)
  "project:created": (project: {
    id: string;
    name: string;
    description?: string | null;
    color: string;
    icon?: string | null;
    order: number;
    conversationCount?: number;
  }) => void;
  "project:updated": (project: {
    id: string;
    name: string;
    description?: string | null;
    color: string;
    icon?: string | null;
    order: number;
    conversationCount?: number;
  }) => void;
  "project:deleted": (data: { projectId: string }) => void;

  // Follow-up suggestion events
  followups_response: (data: {
    messageId: string;
    suggestions: string[];
  }) => void;
  followups_error: (data: { messageId: string; error: string }) => void;
  conversation_followups_response: (data: {
    conversationId: string;
    suggestions: string[];
  }) => void;
  conversation_followups_error: (data: {
    conversationId: string;
    error: string;
  }) => void;
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
    attachments?: Array<{
      public_id: string;
      secure_url: string;
      resource_type: string;
      format?: string;
      extracted_text?: string;
    }>;
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
  request_conversation_followups: (data: {
    conversationId: string;
    messages: Array<{ role: string; content: string }>;
    sessionId: string;
    forceRegenerate?: boolean;
  }) => void;

  // Conversation events (multi-tab sync)
  "conversation:create": (conversation: ConversationListItem) => void;
  "conversation:update": (data: {
    conversationId: string;
    update: Partial<ConversationListItem>;
  }) => void;
  "conversation:delete": (conversationId: string) => void;
  // New events for tracking conversation view state (multi-tab unread)
  "conversation:view": (data: { conversationId: string }) => void;
  "conversation:leave_view": (data: { conversationId: string }) => void;
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
  onMessageStateUpdate?: (data: {
    conversationId: string;
    messageId?: string;
    status: "complete" | "failed";
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
  // Message pin handlers (multi-tab sync)
  onMessagePinned?: (data: {
    conversationId: string;
    messageId: string;
    message?: Message;
  }) => void;
  onMessageUnpinned?: (data: {
    conversationId: string;
    messageId: string;
  }) => void;
  // New conversation activity handler (for conversation list refresh)
  onConversationActivity?: (data: {
    conversationId: string;
    lastActivity: string;
    messageCount: number;
    totalTokens: number;
  }) => void;
  // New unread status handler (for multi-tab unread tracking)
  onConversationUnreadStatus?: (data: {
    conversationId: string;
    hasUnread: boolean;
    socketId?: string;
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

      // logging removed

      // In production (Docker), use the current origin (nginx will proxy)
      // In development, use VITE_BACKEND_URL or fallback to localhost
      let socketUrl: string;

      if (import.meta.env.PROD) {
        // Production: use current origin (nginx handles proxy)
        socketUrl = typeof window !== "undefined" ? window.location.origin : "";
      } else {
        // Development: use explicit backend URL
        socketUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      }

      this.socket = io(socketUrl, {
        auth: {
          token,
        },
        transports: ["websocket", "polling"],
        timeout: 20000,
        autoConnect: false,
      });

      // Connection events
      this.socket.on("connect", () => {
        // logging removed

        if (this.wasDisconnected) {
          // logging removed
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
        // logging removed
        this.wasDisconnected = true;
        this.handlers.onDisconnect?.(reason);

        // Auto-reconnect if not manually disconnected
        if (reason !== "io client disconnect") {
          this.scheduleReconnect();
        }
      });

      this.socket.on("connect_error", (error) => {
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
        // logging removed
        this.handlers.onError?.(error);

        // Dispatch window event for error handling in ChatPage
        try {
          window.dispatchEvent(
            new CustomEvent("socket:error", { detail: error })
          );
        } catch {
          // ignore dispatch errors
        }
      });

      // Message events
      this.socket.on("message:chunk", (data) => {
        this.handlers.onMessageChunk?.(data);
      });

      this.socket.on("message:complete", (data) => {
        this.handlers.onMessageComplete?.(data);
      });

      this.socket.on("message:state_update", (data) => {
        try {
          this.handlers.onMessageStateUpdate?.(data);
        } catch {
          // logging removed
        }
        try {
          window.dispatchEvent(
            new CustomEvent("message:state_update", { detail: data })
          );
        } catch {
          // logging removed
        }
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
        window.dispatchEvent(
          new CustomEvent("conversation:created", { detail: conversation })
        );
      });

      this.socket.on("conversation:updated", (data) => {
        this.handlers.onConversationUpdated?.(data);
        window.dispatchEvent(
          new CustomEvent("conversation:updated", { detail: data })
        );
      });

      this.socket.on("conversation:deleted", (data) => {
        this.handlers.onConversationDeleted?.(data);
        window.dispatchEvent(
          new CustomEvent("conversation:deleted", { detail: data })
        );
      });

      // Conversation moved event (between projects or to/from standalone)
      this.socket.on("conversation:moved", (data) => {
        window.dispatchEvent(
          new CustomEvent("conversation:moved", { detail: data })
        );
      });

      // Project events (realtime CRUD)
      this.socket.on("project:created", (project) => {
        try {
          window.dispatchEvent(
            new CustomEvent("project:created", { detail: project })
          );
        } catch (err) {
          // Ignore dispatch errors
          console.debug("Failed to dispatch project:created", err);
        }
      });

      this.socket.on("project:updated", (project) => {
        try {
          window.dispatchEvent(
            new CustomEvent("project:updated", { detail: project })
          );
        } catch (err) {
          // Ignore dispatch errors
          console.debug("Failed to dispatch project:updated", err);
        }
      });

      this.socket.on("project:deleted", (data) => {
        try {
          window.dispatchEvent(
            new CustomEvent("project:deleted", { detail: data })
          );
        } catch (err) {
          // Ignore dispatch errors
          console.debug("Failed to dispatch project:deleted", err);
        }
      });

      // Unread status tracking (multi-tab)
      this.socket.on("conversation:unread_status", (data) => {
        try {
          // Allow handlers to process unread status
          this.handlers.onConversationUnreadStatus?.(data);
        } catch {
          // logging removed
        }
        try {
          // Dispatch global event for unread status update
          window.dispatchEvent(
            new CustomEvent("conversation:unread_status", { detail: data })
          );
        } catch {
          // logging removed
        }
      });

      // New message notification (sent by other sockets)
      this.socket.on("message:new", (data) => {
        try {
          // Allow handlers to process new message
          this.handlers.onMessageNew?.(data);
        } catch {
          // logging removed
        }
        try {
          window.dispatchEvent(
            new CustomEvent("message:new", { detail: data })
          );
        } catch {
          // logging removed
        }
      });

      // Message pin/unpin events (multi-tab sync)
      this.socket.on("message:pinned", (data) => {
        try {
          this.handlers.onMessagePinned?.(data);
        } catch {
          // logging removed
        }
        try {
          window.dispatchEvent(
            new CustomEvent("message:pinned", { detail: data })
          );
        } catch {
          // logging removed
        }
      });

      this.socket.on("message:unpinned", (data) => {
        try {
          this.handlers.onMessageUnpinned?.(data);
        } catch {
          // logging removed
        }
        try {
          window.dispatchEvent(
            new CustomEvent("message:unpinned", { detail: data })
          );
        } catch {
          // logging removed
        }
      });

      // Conversation activity notification (for refreshing conversation list)
      this.socket.on("conversation:activity", (data) => {
        try {
          // Allow handlers to process activity
          this.handlers.onConversationActivity?.(data);
        } catch {
          // logging removed
        }
        try {
          // Dispatch global event for conversation list refresh
          window.dispatchEvent(
            new CustomEvent("conversation:activity", { detail: data })
          );
        } catch {
          // logging removed
        }
      });

      // Follow-up suggestion events
      this.socket.on("followups_response", (data) => {
        try {
          this.handlers.onFollowupsResponse?.(data);
        } catch {
          // logging removed
        }
      });

      this.socket.on("followups_error", (data) => {
        try {
          this.handlers.onFollowupsError?.(data);
        } catch {
          // logging removed
        }
      });

      // Conversation follow-up suggestion events
      this.socket.on("conversation_followups_response", (data) => {
        try {
          window.dispatchEvent(
            new CustomEvent("conversation_followups_response", { detail: data })
          );
        } catch {
          // logging removed
        }
      });

      this.socket.on("conversation_followups_error", (data) => {
        try {
          window.dispatchEvent(
            new CustomEvent("conversation_followups_error", { detail: data })
          );
        } catch {
          // logging removed
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
    // logging removed
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
      return;
    }

    this.currentConversationId = conversationId;
    this.socket.emit("join:conversation", conversationId);
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit("leave:conversation", conversationId);

    if (this.currentConversationId === conversationId) {
      this.currentConversationId = null;
    }
  }

  /**
   * Send a message through WebSocket
   */
  sendMessage(
    conversationId: string,
    content: string,
    attachments?: Array<{
      public_id: string;
      secure_url: string;
      resource_type: string;
      format?: string;
      extracted_text?: string;
    }>
  ): void {
    if (!this.socket?.connected) {
      const error = new Error("WebSocket not connected") as Error & {
        code?: string;
      };
      error.code = "WEBSOCKET_DISCONNECTED";
      throw error;
    }

    try {
      this.socket.emit("message:send", {
        conversationId,
        content,
        attachments,
      });
    } catch (error) {
      const err = new Error("Failed to send message via WebSocket") as Error & {
        code?: string;
        originalError?: unknown;
      };
      err.code = "WEBSOCKET_SEND_ERROR";
      err.originalError = error;
      throw err;
    }
  }

  sendMessageWithId(
    conversationId: string,
    content: string,
    messageId?: string
  ): void {
    if (!this.socket?.connected) {
      const error = new Error("WebSocket not connected") as Error & {
        code?: string;
      };
      error.code = "WEBSOCKET_DISCONNECTED";
      throw error;
    }

    try {
      this.socket.emit("message:send", { conversationId, content, messageId });
    } catch (error) {
      const err = new Error("Failed to send message via WebSocket") as Error & {
        code?: string;
        originalError?: unknown;
      };
      err.code = "WEBSOCKET_SEND_ERROR";
      err.originalError = error;
      throw err;
    }
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
   * Notify that user is viewing a conversation (for unread tracking)
   */
  viewConversation(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit("conversation:view", { conversationId });
  }

  /**
   * Notify that user left conversation view (for unread tracking)
   */
  leaveConversationView(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit("conversation:leave_view", { conversationId });
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
   * Request conversation follow-up suggestions (for lightbulb in input or new chat)
   */
  requestConversationFollowups(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
    sessionId: string,
    forceRegenerate?: boolean
  ): void {
    if (!this.socket?.connected) {
      throw new Error("WebSocket not connected");
    }
    this.socket.emit("request_conversation_followups", {
      conversationId,
      messages,
      sessionId,
      forceRegenerate,
    });
  }

  /**
   * Schedule auto-reconnect
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const delay = 3000; // 3 seconds

    this.reconnectTimer = setTimeout(() => {
      if (!this.socket?.connected) {
        this.connect().catch(() => {});
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

  /**
   * Get current socket ID (for excluding from broadcasts)
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

export default websocketService;
