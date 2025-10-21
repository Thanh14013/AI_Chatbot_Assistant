// Main message interface
export interface IMessage {
  id: string;
  conversation_id: string; // Foreign key to conversations table
  role: "user" | "assistant" | "system"; // Message role
  content: string; // Message content/text
  tokens_used: number; // Number of tokens in this message
  model: string; // AI model used for this message
  pinned: boolean; // Whether the message is pinned for quick reference
  createdAt: Date;
}

// Interface for creating a new message
export interface CreateMessageInput {
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens_used?: number; // Default: 0, will be calculated
  model?: string; // Default: from conversation model
}

// Interface for message response
export interface MessageResponse {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens_used: number;
  model: string;
  pinned: boolean; // Whether the message is pinned
  createdAt: Date;
}
// Streaming endpoint uses the same MessageResponse types; non-streaming wrappers removed
