/**
 * Application Constants
 * Centralized configuration values to avoid magic numbers
 */

/**
 * Pagination Constants
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
  DEFAULT_PAGE: 1,
} as const;

/**
 * Rate Limiting Constants
 */
export const RATE_LIMITING = {
  MAX_REQUESTS: 1000, // requests per window
  WINDOW_MS: 60 * 60 * 1000, // 1 hour in milliseconds
  MAX_BODY_SIZE: 2 * 1024 * 1024, // 2MB in bytes
  AI_MAX_REQUESTS: 10, // AI requests per minute per user
  AI_WINDOW_MS: 60 * 1000, // 1 minute
} as const;

/**
 * Timeout Constants
 */
export const TIMEOUTS = {
  REQUEST_TIMEOUT: 30000, // 30 seconds
  DUPLICATE_PREVENTION: 5000, // 5 seconds
  WEBSOCKET_PING: 25000, // 25 seconds
  WEBSOCKET_TIMEOUT: 60000, // 60 seconds
  REDIS_READY_CHECK: 4000, // 4 seconds
} as const;

/**
 * Streaming Constants
 */
export const STREAMING = {
  CHUNK_SIZE: 2, // words per chunk
  BUFFER_FLUSH_INTERVAL: 50, // milliseconds
  DEBOUNCE_CLEANUP_INTERVAL: 60000, // 60 seconds
  DEBOUNCER_MAX_SIZE: 10000, // max debouncer map size
} as const;

/**
 * Cache TTL (Time To Live) in seconds
 */
export const CACHE_TTL = {
  USER: 3600, // 1 hour
  CONVERSATION_LIST: 300, // 5 minutes
  MESSAGE_HISTORY: 600, // 10 minutes
  SEMANTIC_SEARCH: 1800, // 30 minutes
  RECENT_MESSAGES: 300, // 5 minutes
} as const;

/**
 * Token Limits
 */
export const TOKENS = {
  MAX_CONTEXT_TOKENS: 4000,
  MAX_COMPLETION_TOKENS: 2000,
  ESTIMATE_CHARS_PER_TOKEN: 4, // rough estimate
} as const;

/**
 * File Upload Limits
 */
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES_PER_MESSAGE: 10,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  ALLOWED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

/**
 * JWT Configuration
 */
export const JWT = {
  ACCESS_TOKEN_EXPIRY: "15m",
  REFRESH_TOKEN_EXPIRY: "7d",
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
} as const;

/**
 * OpenAI Configuration
 */
export const OPENAI = {
  DEFAULT_MODEL: "gpt-4o-mini",
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 2000,
  VISION_MAX_TOKENS: 4096,
  EMBEDDING_MODEL: "text-embedding-3-small",
  EMBEDDING_DIMENSIONS: 1536,
} as const;

/**
 * Database Configuration
 */
export const DATABASE = {
  MAX_CONNECTIONS: 20,
  MIN_CONNECTIONS: 5,
  IDLE_TIMEOUT: 30000, // 30 seconds
  ACQUIRE_TIMEOUT: 60000, // 60 seconds
} as const;

/**
 * Redis Configuration
 */
export const REDIS = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  CONNECT_TIMEOUT: 10000, // 10 seconds
  COMMAND_TIMEOUT: 5000, // 5 seconds
} as const;

/**
 * WebSocket Configuration
 */
export const WEBSOCKET = {
  PING_TIMEOUT: 25000,
  PING_INTERVAL: 60000,
  MAX_RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
  RECONNECTION_DELAY_MAX: 5000,
} as const;

/**
 * Conversation Configuration
 */
export const CONVERSATION = {
  MAX_TITLE_LENGTH: 100,
  DEFAULT_TITLE: "New Conversation",
  MAX_TAGS: 10,
  MAX_TAG_LENGTH: 30,
} as const;

/**
 * Message Configuration
 */
export const MESSAGE = {
  MAX_CONTENT_LENGTH: 10000,
  MIN_CONTENT_LENGTH: 1,
  MAX_PINNED_PER_CONVERSATION: 50,
} as const;

/**
 * Port Configuration
 */
export const PORT = {
  START_PORT: 3000,
  MAX_PORT_ATTEMPTS: 10,
} as const;
