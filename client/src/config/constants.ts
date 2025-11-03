/**
 * Client-Side Application Constants
 * Centralized configuration values for the frontend
 */

/**
 * UI Delays and Timeouts (milliseconds)
 */
export const UI_DELAYS = {
  SCROLL_SMOOTH: 120,
  MESSAGE_HIGHLIGHT: 2000,
  SUCCESS_NOTIFICATION: 3000,
  ERROR_NOTIFICATION: 5000,
  DEBOUNCE_SEARCH: 300,
  DEBOUNCE_INPUT: 500,
  TYPING_INDICATOR: 1000,
  TOAST_DURATION: 4000,
} as const;

/**
 * Retry Configuration
 */
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * WebSocket Configuration
 */
export const WEBSOCKET = {
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000,
  RECONNECT_DELAY_MAX: 5000,
  PING_INTERVAL: 30000, // 30 seconds
  PING_TIMEOUT: 10000, // 10 seconds
} as const;

/**
 * Pagination Constants
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MESSAGES_PER_PAGE: 20,
  CONVERSATIONS_PER_PAGE: 20,
  LOAD_MORE_THRESHOLD: 100, // pixels from bottom to trigger load
} as const;

/**
 * File Upload Limits
 */
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 10,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  ALLOWED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
  PREVIEW_MAX_SIZE: 5 * 1024 * 1024, // 5MB for preview
} as const;

/**
 * Message Configuration
 */
export const MESSAGE = {
  MAX_LENGTH: 10000,
  MIN_LENGTH: 1,
  TYPING_ANIMATION_DELAY: 50,
  STREAM_BUFFER_SIZE: 100,
} as const;

/**
 * Conversation Configuration
 */
export const CONVERSATION = {
  MAX_TITLE_LENGTH: 100,
  DEFAULT_TITLE: "New Conversation",
  MAX_TAGS: 10,
  MAX_TAG_LENGTH: 30,
  AUTO_TITLE_THRESHOLD: 3, // messages before auto-generating title
} as const;

/**
 * Search Configuration
 */
export const SEARCH = {
  MIN_QUERY_LENGTH: 2,
  MAX_QUERY_LENGTH: 100,
  DEBOUNCE_DELAY: 300,
  MAX_RESULTS: 50,
  HIGHLIGHT_SCROLL_ATTEMPTS: 6,
} as const;

/**
 * Cache Configuration (milliseconds)
 */
export const CACHE = {
  CONVERSATION_LIST: 5 * 60 * 1000, // 5 minutes
  MESSAGE_HISTORY: 10 * 60 * 1000, // 10 minutes
  USER_PROFILE: 30 * 60 * 1000, // 30 minutes
  SEARCH_RESULTS: 2 * 60 * 1000, // 2 minutes
} as const;

/**
 * Animation Durations (milliseconds)
 */
export const ANIMATION = {
  FADE_IN: 200,
  FADE_OUT: 150,
  SLIDE_IN: 300,
  SLIDE_OUT: 250,
  BOUNCE: 500,
  HIGHLIGHT_DURATION: 2000,
} as const;

/**
 * Scroll Behavior
 */
export const SCROLL = {
  SMOOTH_DURATION: 300,
  AUTO_SCROLL_THRESHOLD: 150, // pixels from bottom
  LOAD_MORE_OFFSET: 100, // pixels from top to trigger load more
} as const;

/**
 * Offline Queue
 */
export const OFFLINE_QUEUE = {
  MAX_PENDING_MESSAGES: 100,
  RETRY_INTERVAL: 5000, // 5 seconds
  MAX_RETRY_ATTEMPTS: 3,
} as const;

/**
 * LocalStorage Keys
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_PREFERENCES: "user_preferences",
  DRAFT_MESSAGE: "draft_message_",
  OFFLINE_QUEUE: "offline_queue",
  THEME: "theme",
} as const;

/**
 * API Configuration
 */
export const API = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

/**
 * Validation Rules
 */
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
} as const;

/**
 * Feature Flags
 */
export const FEATURES = {
  ENABLE_VOICE_INPUT: false,
  ENABLE_MARKDOWN_PREVIEW: true,
  ENABLE_EXPORT_CONVERSATION: true,
  ENABLE_MULTI_TAB_SYNC: true,
  ENABLE_OFFLINE_MODE: true,
} as const;

/**
 * Theme Colors (can be extended)
 */
export const THEME = {
  PRIMARY_COLOR: "#1890ff",
  SUCCESS_COLOR: "#52c41a",
  ERROR_COLOR: "#ff4d4f",
  WARNING_COLOR: "#faad14",
  INFO_COLOR: "#1890ff",
} as const;

/**
 * Breakpoints for responsive design
 */
export const BREAKPOINTS = {
  XS: 480,
  SM: 576,
  MD: 768,
  LG: 992,
  XL: 1200,
  XXL: 1600,
} as const;
