// WebSocket Event Types for Socket.io

export interface SocketAuthData {
  token?: string;
}

export interface MessageSendData {
  conversationId: string;
  content: string;
}

export interface MessageChunkData {
  conversationId: string;
  chunk: string;
  content: string;
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
}

export interface TypingData {
  userId?: string;
  conversationId: string;
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

export interface ErrorData {
  message: string;
  type?: string;
}

// Server to Client Events
export interface ServerToClientEvents {
  // Message events
  "message:chunk": (data: MessageChunkData) => void;
  "message:complete": (data: MessageCompleteData) => void;
  // New message notification (for other sockets to render immediate UX)
  "message:new": (data: { conversationId: string; message: any }) => void;

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

  // Typing events
  "user:typing:start": (data: TypingData) => void;
  "user:typing:stop": (data: TypingData) => void;
  "ai:typing:start": (data: { conversationId: string }) => void;
  "ai:typing:stop": (data: { conversationId: string }) => void;

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

  // Typing events
  "typing:start": (conversationId: string) => void;
  "typing:stop": (conversationId: string) => void;

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
