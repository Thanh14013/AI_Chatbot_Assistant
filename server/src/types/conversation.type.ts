// Main conversation interface
export interface IConversation {
  id: string;
  user_id: string; // Foreign key to users table
  title: string; // Conversation title/name
  model: string; // AI model used (e.g., "gpt-4", "gpt-3.5-turbo")
  context_window: number; // Number of messages to include in context
  total_tokens_used: number; // Total tokens consumed in this conversation
  message_count: number; // Total number of messages in conversation
  tags: string[]; // Tags for organizing conversations (max 4, max 20 chars each)
  project_id: string | null; // Foreign key to projects table (null if not in a project)
  order_in_project: number; // Display order within project
  createdAt: Date;
  updatedAt: Date;
  deleted_at: Date | null; // Soft delete timestamp (null if not deleted)
}

// Interface for creating a new conversation
export interface CreateConversationInput {
  user_id: string;
  title: string;
  model?: string; // Default: "gpt-3.5-turbo"
  context_window?: number; // Default: 10
  tags?: string[]; // Default: []
  project_id?: string; // Optional: assign to project on creation
}

// Interface for updating a conversation
export interface UpdateConversationInput {
  title?: string;
  model?: string;
  context_window?: number;
  tags?: string[];
  project_id?: string | null;
  order_in_project?: number;
}

// Interface for conversation response (without sensitive data)
export interface ConversationResponse {
  id: string;
  user_id: string;
  title: string;
  model: string;
  context_window: number;
  total_tokens_used: number;
  message_count: number;
  tags: string[];
  project_id: string | null;
  order_in_project: number;
  createdAt: Date;
  updatedAt: Date;
  deleted_at: Date | null;
}

// Interface for conversation list item (minimal data)
export interface ConversationListItem {
  id: string;
  title: string;
  model: string; // Added for edit functionality
  context_window: number; // Added for edit functionality
  message_count: number;
  tags: string[];
  project_id: string | null; // Project ID if conversation is in a project
  order_in_project: number; // Display order within project
  updatedAt: Date;
}
