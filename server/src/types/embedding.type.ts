/**
 * Type definitions for embeddings and semantic search
 */

/**
 * Message Embedding Interface
 * Represents a vector embedding for a message
 */
export interface IMessageEmbedding {
  id: number;
  message_id: string;
  embedding: number[]; // 1536-dimensional vector
  created_at: Date;
}

/**
 * Input for creating a message embedding
 */
export interface CreateEmbeddingInput {
  message_id: string;
  embedding: number[];
}

/**
 * Semantic search result
 * Includes the message and its similarity score
 */
export interface SemanticSearchResult {
  message_id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  similarity: number; // 0-1, where 1 is identical
  tokens_used: number;
  model: string;
  createdAt: Date;
}

/**
 * Semantic search request
 */
export interface SemanticSearchRequest {
  query: string;
  limit?: number; // Default: 5
  similarity_threshold?: number; // Default: 0.4 (0-1)
}

/**
 * Semantic search response
 */
export interface SemanticSearchResponse {
  query: string;
  results: SemanticSearchResult[];
  count: number;
}

/**
 * OpenAI embedding API response
 */
export interface OpenAIEmbeddingResponse {
  object: "list";
  data: Array<{
    object: "embedding";
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}
