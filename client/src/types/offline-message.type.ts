/**
 * Offline Message Types
 * For managing pending messages in localStorage when user is offline
 */

export type MessageStatus = "pending" | "sending" | "sent" | "failed";

/**
 * Pending message stored in localStorage
 */
export interface PendingMessage {
  /** Temporary ID (UUID) for client-side tracking */
  id: string;

  /** Conversation ID this message belongs to */
  conversationId: string;

  /** Message content */
  content: string;

  /** Timestamp when message was created (for expiry check) */
  timestamp: number;

  /** Current status of the message */
  status: MessageStatus;

  /** Number of retry attempts */
  retryCount: number;

  /** ISO string of creation time */
  createdAt: string;

  /** Role (always 'user' for sent messages) */
  role?: "user" | "assistant" | "system";
}

/**
 * Result of sending a message
 */
export interface SendMessageResult {
  success: boolean;
  message?: unknown;
  error?: unknown;
  tempId?: string;
}

/**
 * Network status
 */
export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

/**
 * Sync status for displaying progress
 */
export interface SyncStatus {
  inProgress: boolean;
  total: number;
  synced: number;
}
