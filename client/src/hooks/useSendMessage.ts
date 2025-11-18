/**
 * useSendMessage Hook
 * Orchestrates message sending with offline support and optimistic UI
 */

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  PendingMessage,
  SendMessageResult,
} from "../types/offline-message.type";
import {
  savePendingMessage,
  removePendingMessage,
  updateMessageStatus,
  incrementRetryCount,
} from "../services/offlineMessageService";
import { useNetworkStatus } from "./useNetworkStatus";
import websocketService from "../services/websocket.service";

interface UseSendMessageOptions {
  /** Conversation ID */
  conversationId: string;

  /** Callback when message is added to UI (optimistic) */
  onOptimisticAdd?: (message: PendingMessage) => void;

  /** Callback when message send succeeds */
  onSuccess?: (tempId: string, realMessage?: unknown) => void;

  /** Callback when message send fails */
  onError?: (tempId: string, error: unknown) => void;
}

export function useSendMessage(options: UseSendMessageOptions) {
  const { conversationId, onOptimisticAdd, onSuccess, onError } = options;
  const { isOnline } = useNetworkStatus();

  /**
   * Send a message with offline support
   */
  const sendMessage = useCallback(
    async (content: string): Promise<SendMessageResult> => {
      // 1. Create temporary message with UUID
      const tempId = `temp_${uuidv4()}`;
      const now = new Date();

      const pendingMessage: PendingMessage = {
        id: tempId,
        conversationId,
        content,
        timestamp: now.getTime(),
        status: isOnline ? "sending" : "pending",
        retryCount: 0,
        createdAt: now.toISOString(),
        role: "user",
      };

      // 2. Save to localStorage immediately (for offline persistence)
      savePendingMessage(pendingMessage);

      // 3. Add to UI optimistically (show immediately)
      if (onOptimisticAdd) {
        onOptimisticAdd(pendingMessage);
      }

      // 4. If offline, stop here - message will be sent on reconnect
      if (!isOnline) {
        return {
          success: false,
          tempId,
          error: "offline",
        };
      }

      // 5. Try to send via WebSocket
      try {
        // Update status to sending
        updateMessageStatus(conversationId, tempId, "sending");

        // Send via WebSocket with tempId
        websocketService.sendMessageWithId(conversationId, content, tempId);

        // Immediately notify other parts of the app that this conversation had activity
        try {
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("conversation:activity", {
                detail: {
                  conversationId,
                  lastActivity: new Date().toISOString(),
                },
              })
            );
          }, 0);
        } catch (err) {
          console.error(
            "[useSendMessage] Failed to dispatch activity event:",
            err
          );
        }

        // Note: Success is confirmed by WebSocket event listener
        // The real message will come back from server via 'message:new' event
        // At that point, we'll remove the pending message
        return {
          success: true,
          tempId,
        };
      } catch (error) {
        // 6. Handle send failure

        // Mark as failed in localStorage
        updateMessageStatus(conversationId, tempId, "failed");

        if (onError) {
          onError(tempId, error);
        }

        return {
          success: false,
          tempId,
          error,
        };
      }
    },
    [conversationId, isOnline, onOptimisticAdd, onError]
  );

  /**
   * Retry a failed message
   */
  const retryMessage = useCallback(
    async (message: PendingMessage): Promise<SendMessageResult> => {
      // Check if online
      if (!isOnline) {
        return {
          success: false,
          tempId: message.id,
          error: "offline",
        };
      }

      // Increment retry count
      incrementRetryCount(conversationId, message.id);

      // Update status to sending
      updateMessageStatus(conversationId, message.id, "sending");

      try {
        // Send via WebSocket
        websocketService.sendMessageWithId(
          conversationId,
          message.content,
          message.id
        );

        // Notify conversation activity so sidebar/list updates immediately
        try {
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("conversation:activity", {
                detail: {
                  conversationId,
                  lastActivity: new Date().toISOString(),
                },
              })
            );
          }, 0);
        } catch {
          // ignore if window unavailable
        }
        return {
          success: true,
          tempId: message.id,
        };
      } catch (error) {
        // Mark as failed again
        updateMessageStatus(conversationId, message.id, "failed");

        if (onError) {
          onError(message.id, error);
        }

        return {
          success: false,
          tempId: message.id,
          error,
        };
      }
    },
    [conversationId, isOnline, onError]
  );

  /**
   * Handle successful message delivery (called when real message arrives)
   */
  const handleMessageSuccess = useCallback(
    (tempId: string, realMessage?: unknown) => {
      // Remove from localStorage
      removePendingMessage(conversationId, tempId);

      // Call success callback
      if (onSuccess) {
        onSuccess(tempId, realMessage);
      }
    },
    [conversationId, onSuccess]
  );

  return {
    sendMessage,
    retryMessage,
    handleMessageSuccess,
    isOnline,
  };
}

export default useSendMessage;
