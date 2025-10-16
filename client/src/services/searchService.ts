import axiosInstance from "./axios.service";

export interface GlobalSearchParams {
  query: string;
  limit?: number;
  messagesPerConversation?: number;
  similarity_threshold?: number;
}

export interface ConversationSearchParams {
  query: string;
  limit?: number;
  contextMessages?: number;
}

export interface SearchMessage {
  message_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  similarity: number;
  tokens_used?: number;
  model?: string;
  createdAt: string;
}

export interface ConversationSearchResult {
  conversation_id: string;
  conversation_title: string;
  max_similarity: number;
  message_count: number;
  top_messages: SearchMessage[];
  updated_at: string;
}

export interface GlobalSearchResponse {
  query: string;
  results: ConversationSearchResult[];
  totalConversations: number;
}

export interface ContextMessage {
  message_id: string;
  content: string;
  role: "user" | "assistant";
  similarity: number;
  createdAt?: string;
}

export interface SearchMatchWithContext {
  match: SearchMessage;
  contextBefore: ContextMessage[];
  contextAfter: ContextMessage[];
}

export interface ConversationSearchResponse {
  query: string;
  bestMatch: SearchMessage | null;
  results: SearchMatchWithContext[];
}

/**
 * Search across all user's conversations
 */
export async function searchAllConversations(
  params: GlobalSearchParams
): Promise<GlobalSearchResponse> {
  const response = await axiosInstance.post<{
    success: boolean;
    data: GlobalSearchResponse;
  }>(`/search/all`, params);

  return response.data.data;
}

/**
 * Search within a specific conversation
 */
export async function searchConversation(
  conversationId: string,
  params: ConversationSearchParams
): Promise<ConversationSearchResponse> {
  const response = await axiosInstance.post<{
    success: boolean;
    data: ConversationSearchResponse;
  }>(`/search/conversation/${conversationId}`, params);

  return response.data.data;
}

export default {
  searchAllConversations,
  searchConversation,
};
