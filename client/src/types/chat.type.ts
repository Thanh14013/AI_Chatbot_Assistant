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
  pinned?: boolean; // Whether the message is pinned (optional for client-side messages)
  createdAt: string | Date;
  // File attachments linked to this message
  attachments?: Array<{
    id?: number;
    public_id: string;
    secure_url: string;
    resource_type: "image" | "video" | "raw";
    format?: string;
    original_filename?: string;
    size_bytes?: number;
    width?: number;
    height?: number;
    thumbnail_url?: string;
    extracted_text?: string;
  }>;
  // Optional client-only fields used by the UI (not persisted to server)
  // localStatus: status for optimistic / retry flows
  localStatus?: "pending" | "failed" | "sent" | "sending";
  // isTyping: mark an assistant typing placeholder
  isTyping?: boolean;
  // followupSuggestions: cached follow-up suggestions for this message
  followupSuggestions?: string[];
  // isLoadingFollowups: whether suggestions are currently being generated
  isLoadingFollowups?: boolean;
  // Retry metadata
  retryCount?: number;
  errorMessage?: string;
  lastAttemptAt?: string | Date;
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
  tags: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
  deleted_at: string | Date | null;
}

// Minimal list item for conversations (server-side `ConversationListItem`)
export interface ConversationListItem {
  id: string;
  title: string;
  model?: string; // Added for edit functionality
  context_window?: number; // Added for edit functionality
  message_count: number;
  tags?: string[]; // Tags for organizing conversations
  updatedAt: string | Date;
  // Client-side only field for unread tracking (multi-tab)
  hasUnread?: boolean;
}

// Input for creating a conversation (client -> server)
export interface CreateConversationInput {
  user_id: string;
  title: string;
  model?: string;
  context_window?: number;
  tags?: string[];
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
