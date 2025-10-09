/**
 * Chat related type definitions - aligned with server models
 * These types mirror the server-side interfaces in `server/src/types`.
 */

// Message role union (matches server's union type)
export type MessageRole = "user" | "assistant" | "system";

// Message shape returned by the server (MessageResponse / IMessage)
export interface Message {
  id: string;
  conversation_id: string; // FK to conversations table
  role: MessageRole;
  content: string;
  tokens_used: number;
  model: string;
  createdAt: string | Date;
  // Optional client-only fields used by the UI (not persisted to server)
  // localStatus: status for optimistic / retry flows
  localStatus?: "pending" | "failed" | "sent";
  // isTyping: mark an assistant typing placeholder
  isTyping?: boolean;
}

// Payload to create a new message (client -> server)
export interface CreateMessageInput {
  conversation_id: string;
  role: MessageRole;
  content: string;
  tokens_used?: number;
  model?: string;
}

// Conversation shape returned by the server (IConversation / ConversationResponse)
export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  model: string;
  context_window: number;
  total_tokens_used: number;
  message_count: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  deleted_at: string | Date | null;
}

// Minimal list item for conversations (server-side `ConversationListItem`)
export interface ConversationListItem {
  id: string;
  title: string;
  message_count: number;
  updatedAt: string | Date;
}

// Input for creating a conversation (client -> server)
export interface CreateConversationInput {
  user_id: string;
  title: string;
  model?: string;
  context_window?: number;
}

// Client UI state for chat
export interface ChatState {
  conversations: ConversationListItem[]; // use list items for sidebar
  currentConversation: Conversation | null;
  messages: Message[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
}
