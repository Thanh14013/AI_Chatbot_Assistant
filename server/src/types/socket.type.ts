// WebSocket Event Types for Socket.io

export interface SocketAuthData {
  token?: string;
}

export interface MessageSendData {
  conversationId: string;
  content: string;
  messageId?: string;
}

export interface MessageChunkData {
  conversationId: string;
  chunk: string;
  content: string;
  messageId?: string;
}

export interface MessageCompleteData {
  userMessage: {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    tokens_used: number;
    model: string;
    createdAt: Date;
  };
  assistantMessage: {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    tokens_used: number;
    model: string;
    createdAt: Date;
  };
  conversation: {
    id: string;
    title: string;
    model: string;
    total_tokens_used: number;
    message_count: number;
    updatedAt: Date;
  };
  messageId?: string;
}

export interface TypingData {
  userId?: string;
  conversationId: string;
  messageId?: string;
}

export interface ConversationJoinData {
  conversationId: string;
}

export interface ConversationUpdateData {
  conversationId: string;
  update: {
    title?: string;
    model?: string;
    [key: string]: any;
  };
}

export interface ConversationViewData {
  conversationId: string;
}

export interface ConversationUnreadStatusData {
  conversationId: string;
  hasUnread: boolean;
  socketId?: string;
}

export interface ProjectData {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  order: number;
  conversationCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ErrorData {
  message: string;
  type?: string;
}

export interface RequestFollowupsData {
  sessionId: string;
  messageId: string;
  lastUserMessage: string;
  lastBotMessage: string;
}

export interface RequestConversationFollowupsData {
  sessionId: string;
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
}

export interface FollowupsResponseData {
  messageId: string;
  suggestions: string[];
}

export interface ConversationFollowupsResponseData {
  conversationId: string;
  suggestions: string[];
}

// Server to Client Events
export interface ServerToClientEvents {
  // Message events
  "message:chunk": (data: MessageChunkData) => void;
  "message:complete": (data: MessageCompleteData) => void;
  // New message notification (for other sockets to render immediate UX)
  "message:new": (data: { conversationId: string; message: any; messageId?: string }) => void;
  // Pin/unpin events (for real-time sync across tabs)
  "message:pinned": (data: { conversationId: string; messageId: string; message?: any }) => void;
  "message:unpinned": (data: { conversationId: string; messageId: string }) => void;

  // Conversation events
  "conversation:joined": (data: { conversationId: string }) => void;
  "conversation:left": (data: { conversationId: string }) => void;
  "conversation:created": (conversation: any) => void;
  "conversation:updated": (data: ConversationUpdateData) => void;
  "conversation:deleted": (data: { conversationId: string }) => void;
  // New event for conversation activity (for list refresh)
  "conversation:activity": (data: {
    conversationId: string;
    lastActivity: string;
    messageCount: number;
    totalTokens: number;
  }) => void;
  // New event for unread status tracking (multi-tab sync)
  "conversation:unread_status": (data: ConversationUnreadStatusData) => void;

  // Project events (for real-time CRUD)
  "project:created": (project: ProjectData) => void;
  "project:updated": (project: ProjectData) => void;
  "project:deleted": (data: { projectId: string }) => void;

  // Typing events
  "user:typing:start": (data: TypingData) => void;
  "user:typing:stop": (data: TypingData) => void;
  "ai:typing:start": (data: TypingData) => void;
  "ai:typing:stop": (data: TypingData) => void;

  // Follow-up suggestions
  followups_response: (data: FollowupsResponseData) => void;
  followups_error: (data: { messageId: string; error: string }) => void;
  conversation_followups_response: (data: ConversationFollowupsResponseData) => void;
  conversation_followups_error: (data: { conversationId: string; error: string }) => void;

  // Connection events
  pong: () => void;
  error: (data: ErrorData) => void;
}

// Client to Server Events
export interface ClientToServerEvents {
  // Message events
  "message:send": (data: MessageSendData) => void;

  // Conversation events
  "join:conversation": (conversationId: string) => void;
  "leave:conversation": (conversationId: string) => void;
  "conversation:create": (conversation: any) => void;
  "conversation:update": (data: ConversationUpdateData) => void;
  "conversation:delete": (conversationId: string) => void;
  // New events for tracking conversation view state (multi-tab unread)
  "conversation:view": (data: ConversationViewData) => void;
  "conversation:leave_view": (data: ConversationViewData) => void;

  // Typing events
  "typing:start": (conversationId: string) => void;
  "typing:stop": (conversationId: string) => void;

  // Follow-up suggestions
  request_followups: (data: RequestFollowupsData) => void;
  request_conversation_followups: (data: RequestConversationFollowupsData) => void;

  // Connection events
  ping: () => void;
}

// Inter-server events (for scaling with multiple servers)
export interface InterServerEvents {
  "user:broadcast": (userId: string, event: string, data: any) => void;
}

// Socket data attached to each socket
export interface SocketData {
  user?: {
    id: string;
    name: string;
    email: string;
  };
  userId?: string;
}
