/**
 * Offline Message Service
 * Manages pending messages in localStorage with expiry and cleanup
 */

import type { PendingMessage } from "../types/offline-message.type";

// Constants
const STORAGE_PREFIX = "pending_messages_";
const EXPIRE_TIME = 3 * 60 * 1000; // 3 minutes in milliseconds
const MAX_PENDING_MESSAGES = 50; // Maximum pending messages per conversation

/**
 * Generate storage key for a conversation
 */
function getStorageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

/**
 * Check if a message has expired (> 3 minutes old)
 */
function isExpired(message: PendingMessage): boolean {
  return Date.now() - message.timestamp > EXPIRE_TIME;
}

/**
 * Save a pending message to localStorage
 */
export function savePendingMessage(message: PendingMessage): void {
  try {
    const key = getStorageKey(message.conversationId);
    const existing = getPendingMessages(message.conversationId);

    // Prevent spam: limit max pending messages
    if (existing.length >= MAX_PENDING_MESSAGES) {
      console.warn(
        `Max pending messages (${MAX_PENDING_MESSAGES}) reached for conversation ${message.conversationId}`
      );
      return;
    }

    // Add new message
    const updated = [...existing, message];
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (error) {
    console.error("[OFFLINE] Failed to save pending message:", error);
    // If localStorage is full or disabled, fail gracefully
  }
}

/**
 * Get all pending messages for a conversation (excluding expired ones)
 */
export function getPendingMessages(conversationId: string): PendingMessage[] {
  try {
    const key = getStorageKey(conversationId);
    const data = localStorage.getItem(key);

    if (!data) {
      return [];
    }

    const messages: PendingMessage[] = JSON.parse(data);

    // Filter out expired messages
    const validMessages = messages.filter((msg) => !isExpired(msg));

    // Update storage if we filtered anything out
    if (validMessages.length !== messages.length) {
      localStorage.setItem(key, JSON.stringify(validMessages));
    }

    return validMessages;
  } catch (error) {
    console.error("[OFFLINE] Failed to get pending messages:", error);
    return [];
  }
}

/**
 * Update message status
 */
export function updateMessageStatus(
  conversationId: string,
  messageId: string,
  status: PendingMessage["status"]
): void {
  try {
    const messages = getPendingMessages(conversationId);
    const updated = messages.map((msg) =>
      msg.id === messageId ? { ...msg, status } : msg
    );

    const key = getStorageKey(conversationId);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (error) {
    console.error("[OFFLINE] Failed to update message status:", error);
  }
}

/**
 * Increment retry count for a message
 */
export function incrementRetryCount(
  conversationId: string,
  messageId: string
): void {
  try {
    const messages = getPendingMessages(conversationId);
    const updated = messages.map((msg) =>
      msg.id === messageId ? { ...msg, retryCount: msg.retryCount + 1 } : msg
    );

    const key = getStorageKey(conversationId);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (error) {
    console.error("[OFFLINE] Failed to increment retry count:", error);
  }
}

/**
 * Remove a pending message (after successful send)
 */
export function removePendingMessage(
  conversationId: string,
  messageId: string
): void {
  try {
    const messages = getPendingMessages(conversationId);
    const updated = messages.filter((msg) => msg.id !== messageId);

    const key = getStorageKey(conversationId);

    if (updated.length === 0) {
      // Remove key if no messages left
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(updated));
    }
  } catch (error) {
    console.error("[OFFLINE] Failed to remove pending message:", error);
  }
}

/**
 * Get all pending messages from all conversations
 */
export function getAllPendingMessages(): PendingMessage[] {
  try {
    const allMessages: PendingMessage[] = [];

    // Iterate through all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key && key.startsWith(STORAGE_PREFIX)) {
        const conversationId = key.replace(STORAGE_PREFIX, "");
        const messages = getPendingMessages(conversationId);
        allMessages.push(...messages);
      }
    }

    return allMessages;
  } catch (error) {
    console.error("[OFFLINE] Failed to get all pending messages:", error);
    return [];
  }
}

/**
 * Clean up expired messages from all conversations
 */
export function cleanExpiredMessages(): number {
  try {
    let totalCleaned = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key && key.startsWith(STORAGE_PREFIX)) {
        const data = localStorage.getItem(key);
        if (!data) continue;

        const messages: PendingMessage[] = JSON.parse(data);
        const validMessages = messages.filter((msg) => !isExpired(msg));

        const cleaned = messages.length - validMessages.length;
        totalCleaned += cleaned;

        if (cleaned > 0) {
          if (validMessages.length === 0) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(validMessages));
          }
        }
      }
    }

    if (totalCleaned > 0) {
    }

    return totalCleaned;
  } catch (error) {
    console.error("[OFFLINE] Failed to clean expired messages:", error);
    return 0;
  }
}

/**
 * Clear all pending messages for a conversation
 */
export function clearPendingMessages(conversationId: string): void {
  try {
    const key = getStorageKey(conversationId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error("[OFFLINE] Failed to clear pending messages:", error);
  }
}

/**
 * Get total count of pending messages across all conversations
 */
export function getTotalPendingCount(): number {
  return getAllPendingMessages().length;
}

export default {
  savePendingMessage,
  getPendingMessages,
  updateMessageStatus,
  incrementRetryCount,
  removePendingMessage,
  getAllPendingMessages,
  cleanExpiredMessages,
  clearPendingMessages,
  getTotalPendingCount,
};
