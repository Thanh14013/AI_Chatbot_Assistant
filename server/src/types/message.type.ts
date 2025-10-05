// Main message interface
export interface IMessage {
  id: string;
  conversation_id: string; // Foreign key to conversations table
  role: "user" | "assistant" | "system"; // Message role
  content: string; // Message content/text
  tokens_used: number; // Number of tokens in this message
  model: string; // AI model used for this message
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
  createdAt: Date;
}

// Interface for sending a message and getting AI response
export interface SendMessageInput {
  conversation_id: string;
  content: string;
}

// Interface for AI response with both user message and assistant reply
export interface SendMessageResponse {
  userMessage: MessageResponse;
  assistantMessage: MessageResponse;
  conversation: {
    id: string;
    total_tokens_used: number;
    message_count: number;
  };
}
