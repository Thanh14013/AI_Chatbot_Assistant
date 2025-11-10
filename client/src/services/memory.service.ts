/**
 * Long Term Memory (LTM) Service
 * Handles API calls for Long Term Memory operations
 */

import axiosInstance from "./axios.service";
import type { ApiResponse } from "../types";

/**
 * Memory Fact
 */
export interface MemoryFact {
  category: string;
  fact: string;
  confidence: number;
  source: string;
  timestamp: string;
}

/**
 * User Memory Profile
 */
export interface UserMemoryProfile {
  facts: MemoryFact[];
  interests: string[];
  preferences: Record<string, unknown>;
  context: Record<string, unknown>;
  factsByCategory?: Record<string, string[]>;
  recentTopics?: string[];
}

/**
 * Memory Event
 */
export interface MemoryEvent {
  id: string;
  type: "conversation" | "fact_learned" | "preference_updated";
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  relatedFacts?: string[];
}

/**
 * Memory Events Response
 */
export interface MemoryEventsResponse {
  events: MemoryEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Smart Suggestions Response
 */
export interface SmartSuggestionsResponse {
  suggestions: string[];
  basedOn: string[];
}

/**
 * Memory Statistics
 */
export interface MemoryStats {
  totalFacts: number;
  totalConversations: number;
  totalMessages?: number;
  totalInterests: number;
  memorySize: string;
  lastUpdated: string;
  factsByCategory?: Record<string, number>;
}

/**
 * Memory Configuration
 */
export interface MemoryConfig {
  enabled: boolean;
  maxFacts: number;
  retentionDays: number;
  categories: string[];
}

/**
 * Get user memory profile with learned facts and interests
 */
export const getMemoryProfile = async (): Promise<
  ApiResponse & { data: UserMemoryProfile }
> => {
  const response = await axiosInstance.get("/memory/profile");
  return response.data;
};

/**
 * Get memory events with pagination
 * @param params - Optional pagination and filter parameters
 */
export const getMemoryEvents = async (params?: {
  page?: number;
  limit?: number;
  type?: "conversation" | "fact_learned" | "preference_updated";
}): Promise<ApiResponse & { data: MemoryEventsResponse }> => {
  const queryParams = new URLSearchParams();

  if (params?.page) {
    queryParams.append("page", params.page.toString());
  }
  if (params?.limit) {
    queryParams.append("limit", params.limit.toString());
  }
  if (params?.type) {
    queryParams.append("type", params.type);
  }

  const queryString = queryParams.toString();
  const response = await axiosInstance.get(
    `/memory/events${queryString ? `?${queryString}` : ""}`
  );
  return response.data;
};

/**
 * Get smart chat suggestions based on user's memory profile
 * @param count - Optional number of suggestions to return (default: 5)
 */
export const getSmartSuggestions = async (
  count?: number
): Promise<ApiResponse & { data: SmartSuggestionsResponse }> => {
  const response = await axiosInstance.get(
    `/memory/suggestions${count ? `?count=${count}` : ""}`
  );
  return response.data;
};

/**
 * Get memory statistics
 */
export const getMemoryStats = async (): Promise<
  ApiResponse & { data: MemoryStats }
> => {
  const response = await axiosInstance.get("/memory/stats");
  return response.data;
};

/**
 * Get Long Term Memory system configuration
 */
export const getMemoryConfig = async (): Promise<
  ApiResponse & { data: MemoryConfig }
> => {
  const response = await axiosInstance.get("/memory/config");
  return response.data;
};

/**
 * Clear all user memory data (irreversible!)
 * WARNING: This will delete all stored facts, events, and learned data
 */
export const clearMemory = async (): Promise<ApiResponse> => {
  const response = await axiosInstance.delete("/memory/clear");
  return response.data;
};

/**
 * Memory Service Object
 */
const memoryService = {
  getMemoryProfile,
  getMemoryEvents,
  getSmartSuggestions,
  getMemoryStats,
  getMemoryConfig,
  clearMemory,
};

export default memoryService;
