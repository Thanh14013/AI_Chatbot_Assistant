/**
 * Type definitions for Long Term Memory (LTM) System
 * Defines interfaces for user profiles, memory events, and conversation summaries
 */

// ==================== USER PROFILE TYPES ====================

/**
 * User Facts - Stable information about the user
 * Stored in Redis for fast access
 */
export interface UserFacts {
  personal?: PersonalFacts;
  preferences?: PreferenceFacts;
  technical_context?: TechnicalContextFacts;
}

/**
 * Personal information about the user
 */
export interface PersonalFacts {
  name?: string;
  location?: string;
  occupation?: string;
  company?: string;
  timezone?: string;
  language?: string;
}

/**
 * User preferences and interests
 */
export interface PreferenceFacts {
  languages?: string[]; // Programming languages
  topics?: string[]; // Topics of interest
  frameworks?: string[]; // Frameworks and tools
  communication_style?: string; // e.g., "technical", "beginner-friendly", "concise"
  learning_style?: string; // e.g., "visual", "hands-on", "theoretical"
}

/**
 * Technical context - Current projects and challenges
 */
export interface TechnicalContextFacts {
  current_projects?: string[];
  frameworks?: string[];
  challenges?: string[];
  goals?: string[];
  recent_technologies?: string[];
}

/**
 * Complete user profile stored in Redis
 */
export interface UserProfile {
  user_id: string;
  facts: UserFacts;
  updated_at: string; // ISO timestamp
  version: number; // Incremented on each update
}

// ==================== MEMORY EVENT TYPES ====================

/**
 * Memory event type - categorizes the type of interaction
 */
export type MemoryEventType =
  | "question" // User asked a question
  | "problem" // User reported a problem/error
  | "learning" // User learned something new
  | "preference" // User expressed a preference
  | "achievement" // User accomplished something
  | "context" // General context information
  | "followup"; // Follow-up from previous conversation

/**
 * Memory event importance score (1-10)
 * 10 = Critical personal information
 * 7-9 = Important context
 * 4-6 = Normal interaction
 * 1-3 = Trivial information
 */
export type ImportanceScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Memory event stored in PostgreSQL
 */
export interface MemoryEvent {
  id?: string; // UUID (auto-generated)
  user_id: string;
  conversation_id?: string | null;
  event_type: MemoryEventType;
  summary: string; // Short summary (max 500 chars)
  content?: string | null; // Full content (optional)
  keywords: string[]; // Keywords for searching
  embedding?: number[] | null; // OpenAI embedding vector (1536 dimensions)
  context?: Record<string, any>; // Additional context (JSON)
  importance_score: ImportanceScore;
  created_at?: Date;
  accessed_at?: Date;
  access_count?: number;
}

/**
 * Input for creating a new memory event
 */
export interface CreateMemoryEventInput {
  user_id: string;
  conversation_id?: string | null;
  event_type: MemoryEventType;
  summary: string;
  content?: string;
  keywords: string[];
  importance_score?: ImportanceScore; // Default: 5
  context?: Record<string, any>;
}

/**
 * Memory event with similarity score (for semantic search results)
 */
export interface MemoryEventWithSimilarity extends MemoryEvent {
  similarity?: number; // Cosine similarity score (0-1)
}

// ==================== CONVERSATION SUMMARY TYPES ====================

/**
 * Conversation outcome status
 */
export type ConversationOutcome = "resolved" | "ongoing" | "needs_followup" | "abandoned";

/**
 * Conversation summary stored in PostgreSQL
 */
export interface ConversationSummary {
  id?: string; // UUID (auto-generated)
  user_id: string;
  conversation_id: string;
  title: string; // Brief title
  summary: string; // Summary of conversation
  key_topics: string[]; // Key topics discussed
  technical_topics: string[]; // Technical topics/technologies
  outcome?: ConversationOutcome | null;
  followup_suggestions?: string[] | null;
  message_count: number;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Input for creating/updating a conversation summary
 */
export interface UpdateConversationSummaryInput {
  conversation_id: string;
  title?: string;
  summary?: string;
  key_topics?: string[];
  technical_topics?: string[];
  outcome?: ConversationOutcome;
  followup_suggestions?: string[];
  message_count?: number;
}

// ==================== MEMORY ANALYSIS TYPES ====================

/**
 * Result from Meta-LLM memory extraction
 */
export interface MemoryAnalysis {
  facts: Partial<UserFacts>; // New or updated facts
  events: Array<{
    event_type: MemoryEventType;
    summary: string;
    content?: string;
    keywords: string[];
    importance_score?: ImportanceScore;
    context?: Record<string, any>;
  }>;
  conversation_summary: {
    title?: string;
    summary?: string;
    key_topics?: string[];
    technical_topics?: string[];
    outcome?: ConversationOutcome;
    followup_suggestions?: string[];
  } | null;
}

/**
 * Parameters for memory extraction
 */
export interface MemoryExtractionParams {
  userId: string;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  currentProfile: UserProfile | null;
}

// ==================== CONTEXT BUILDING TYPES ====================

/**
 * Options for building memory-enhanced context
 */
export interface MemoryContextOptions {
  includeProfile?: boolean; // Include user profile facts (default: true)
  includeEvents?: boolean; // Include relevant events (default: true)
  maxEvents?: number; // Max number of events to include (default: 5)
  minImportanceScore?: ImportanceScore; // Min importance score (default: 3)
}

/**
 * Memory context to be injected into system prompt
 */
export interface MemoryContext {
  profile: UserProfile | null;
  relevantEvents: MemoryEventWithSimilarity[];
  conversationSummaries: ConversationSummary[];
}

// ==================== API RESPONSE TYPES ====================

/**
 * Response for GET /api/memory/profile
 */
export interface GetProfileResponse {
  success: boolean;
  data: UserProfile | null;
}

/**
 * Response for GET /api/memory/events
 */
export interface GetEventsResponse {
  success: boolean;
  data: {
    events: MemoryEvent[];
    total: number;
    page?: number;
    limit?: number;
  };
}

/**
 * Response for GET /api/memory/suggestions
 */
export interface GetSuggestionsResponse {
  success: boolean;
  data: {
    suggestions: string[];
    recent_topics: string[];
    recent_conversations: Array<{
      conversation_id: string;
      title: string;
      summary: string;
      updated_at: Date;
    }>;
  };
}

/**
 * Response for POST /api/memory/clear
 */
export interface ClearMemoryResponse {
  success: boolean;
  message: string;
  data?: {
    events_deleted: number;
    summaries_deleted: number;
    profile_cleared: boolean;
  };
}

// ==================== UTILITY TYPES ====================

/**
 * Options for merging tags/arrays
 */
export interface MergeOptions {
  maxLength?: number; // Max number of items to keep
  deduplicate?: boolean; // Remove duplicates (default: true)
  caseSensitive?: boolean; // Case sensitive comparison (default: false)
}

/**
 * Statistics about user memory
 */
export interface MemoryStats {
  total_events: number;
  total_conversations_summarized: number;
  profile_version: number;
  profile_last_updated: string;
  average_importance_score: number;
  most_common_topics: string[];
  most_common_event_types: Record<MemoryEventType, number>;
}

/**
 * Configuration for LTM system
 */
export interface LTMConfig {
  enabled: boolean;
  redis_ttl: number; // TTL in seconds (default: 7 days)
  meta_model: string; // Model for memory extraction (default: gpt-4o-mini)
  max_events_per_user: number; // Max events to keep per user
  background_delay: number; // Delay before background analysis (ms)
  min_message_length: number; // Min message length to trigger analysis
}
