/**
 * useOfflineMessages Hook
 * Manages pending messages lifecycle, auto-cleanup, and retry on reconnect
 */

import { useState, useEffect, useCallback } from "react";
import type { PendingMessage, SyncStatus } from "../types/offline-message.type";
import * as offlineMessageService from "../services/offlineMessageService";
import { useNetworkStatus } from "./useNetworkStatus";

interface UseOfflineMessagesReturn {
  pendingMessages: PendingMessage[];
  syncStatus: SyncStatus;
  addPendingMessage: (message: PendingMessage) => void;
  removePendingMessage: (messageId: string) => void;
  updateMessageStatus: (
    messageId: string,
    status: PendingMessage["status"]
  ) => void;
  retryMessage: (messageId: string) => Promise<void>;
  retryAllMessages: () => Promise<void>;
  refreshPendingMessages: () => void;
}

export function useOfflineMessages(
  conversationId: string,
  onRetry?: (message: PendingMessage) => Promise<void>
): UseOfflineMessagesReturn {
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    inProgress: false,
    total: 0,
    synced: 0,
  });
  const { isOnline } = useNetworkStatus();

  // Load pending messages from localStorage
  const loadPendingMessages = useCallback(() => {
    const messages = offlineMessageService.getPendingMessages(conversationId);
    setPendingMessages(messages);
  }, [conversationId]);

  // Initial load
  useEffect(() => {
    loadPendingMessages();
  }, [loadPendingMessages]);

  // Auto-cleanup expired messages every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const cleaned = offlineMessageService.cleanExpiredMessages();
      if (cleaned > 0) {
        loadPendingMessages(); // Reload to update UI
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [loadPendingMessages]);

  // Add a new pending message
  const addPendingMessage = useCallback(
    (message: PendingMessage) => {
      offlineMessageService.savePendingMessage(message);
      loadPendingMessages();
    },
    [loadPendingMessages]
  );

  // Remove a pending message
  const removePendingMessage = useCallback(
    (messageId: string) => {
      offlineMessageService.removePendingMessage(conversationId, messageId);
      loadPendingMessages();
    },
    [conversationId, loadPendingMessages]
  );

  // Update message status
  const updateMessageStatus = useCallback(
    (messageId: string, status: PendingMessage["status"]) => {
      offlineMessageService.updateMessageStatus(
        conversationId,
        messageId,
        status
      );
      loadPendingMessages();
    },
    [conversationId, loadPendingMessages]
  );

  // Retry all pending messages
  const retryAllMessages = useCallback(async () => {
    if (!onRetry) {
      console.warn("[OFFLINE] No retry handler provided");
      return;
    }

    const messages = offlineMessageService.getPendingMessages(conversationId);

    if (messages.length === 0) {
      return;
    }

    setSyncStatus({
      inProgress: true,
      total: messages.length,
      synced: 0,
    });

    console.log(`🔄 [OFFLINE] Starting sync of ${messages.length} messages...`);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      try {
        offlineMessageService.updateMessageStatus(
          conversationId,
          message.id,
          "sending"
        );
        loadPendingMessages();

        await onRetry(message);

        offlineMessageService.removePendingMessage(conversationId, message.id);
        loadPendingMessages();

        setSyncStatus((prev) => ({ ...prev, synced: prev.synced + 1 }));
        console.log(`✅ [OFFLINE] Synced ${i + 1}/${messages.length}`);
      } catch (error) {
        console.error(
          `❌ [OFFLINE] Failed to sync message ${message.id}:`,
          error
        );
        offlineMessageService.updateMessageStatus(
          conversationId,
          message.id,
          "failed"
        );
        offlineMessageService.incrementRetryCount(conversationId, message.id);
        loadPendingMessages();
      }

      // Small delay between retries to avoid overwhelming server
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("✅ [OFFLINE] Sync complete");
    setSyncStatus({
      inProgress: false,
      total: 0,
      synced: 0,
    });
  }, [conversationId, onRetry, loadPendingMessages]);

  // Retry a single message
  const retryMessage = useCallback(
    async (messageId: string) => {
      if (!onRetry) {
        console.warn("[OFFLINE] No retry handler provided");
        return;
      }

      const message = pendingMessages.find((msg) => msg.id === messageId);
      if (!message) {
        console.warn(`[OFFLINE] Message ${messageId} not found`);
        return;
      }

      try {
        console.log(`🔄 [OFFLINE] Retrying message: ${messageId}`);
        updateMessageStatus(messageId, "sending");

        await onRetry(message);

        // Success: remove from pending
        removePendingMessage(messageId);
        console.log(`✅ [OFFLINE] Message ${messageId} sent successfully`);
      } catch (error) {
        // Failed: mark as failed
        console.error(`❌ [OFFLINE] Message ${messageId} retry failed:`, error);
        updateMessageStatus(messageId, "failed");
        offlineMessageService.incrementRetryCount(conversationId, messageId);
      }
    },
    [
      conversationId,
      pendingMessages,
      onRetry,
      updateMessageStatus,
      removePendingMessage,
    ]
  );

  // Listen for network reconnection and retry all messages
  useEffect(() => {
    const handleReconnect = async () => {
      if (isOnline && pendingMessages.length > 0) {
        console.log(
          `🔄 [OFFLINE] Network reconnected, retrying ${pendingMessages.length} messages...`
        );
        await retryAllMessages();
      }
    };

    window.addEventListener("network-reconnected", handleReconnect);

    return () => {
      window.removeEventListener("network-reconnected", handleReconnect);
    };
  }, [isOnline, pendingMessages.length, retryAllMessages]);

  // Refresh pending messages (useful for manual refresh)
  const refreshPendingMessages = useCallback(() => {
    loadPendingMessages();
  }, [loadPendingMessages]);

  return {
    pendingMessages,
    syncStatus,
    addPendingMessage,
    removePendingMessage,
    updateMessageStatus,
    retryMessage,
    retryAllMessages,
    refreshPendingMessages,
  };
}

export default useOfflineMessages;
