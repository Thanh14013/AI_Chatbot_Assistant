/**
 * useChat Hook
 * Manages conversations list with optimistic updates for smooth UX
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getConversations,
  type GetConversationsResult,
} from "../services/chat.service";
import type { ConversationListItem } from "../types/chat.type";

interface UseChatOptions {
  searchQuery?: string;
  limit?: number;
}

interface UseChatReturn {
  conversations: ConversationListItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  page: number;
  // Methods
  loadConversations: (reset?: boolean, force?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  updateConversationOptimistic: (
    conversationId: string,
    updates: Partial<ConversationListItem>
  ) => void;
  moveConversationToTop: (conversationId: string) => void;
  removeConversation: (conversationId: string) => void;
  refreshConversations: () => Promise<void>;
}

/**
 * Custom hook for managing conversations list with optimistic updates
 * Provides smooth real-time updates without needing full page reloads
 */
export const useChat = (options: UseChatOptions = {}): UseChatReturn => {
  const { searchQuery = "", limit = 20 } = options;

  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // Track if background fetch is in progress to avoid duplicate requests
  const fetchingRef = useRef(false);

  /**
   * Load conversations from server
   * @param reset - If true, resets to page 1 and replaces list
   */
  const loadConversations = useCallback(
    async (reset = false, force = false) => {
      // Prevent duplicate concurrent requests unless forced
      if (fetchingRef.current && !force) return;

      const targetPage = reset ? 1 : page;

      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      // Mark as fetching (force will still set this so other calls will wait)
      fetchingRef.current = true;

      try {
        const result: GetConversationsResult = await getConversations({
          page: targetPage,
          limit,
          search: searchQuery.trim() || undefined,
        });

        if (reset) {
          setConversations(result.conversations);
          setPage(1);
        } else {
          setConversations((prev) => [...prev, ...result.conversations]);
          setPage(targetPage);
        }

        setHasMore(result.pagination.page < result.pagination.totalPages);
      } catch {
        if (reset) {
          setConversations([]);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        fetchingRef.current = false;
      }
    },
    [page, limit, searchQuery]
  );

  /**
   * Load next page of conversations
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || fetchingRef.current) return;

    setIsLoadingMore(true);
    fetchingRef.current = true;

    try {
      const result = await getConversations({
        page: page + 1,
        limit,
        search: searchQuery.trim() || undefined,
      });

      setConversations((prev) => [...prev, ...result.conversations]);
      setPage((prev) => prev + 1);
      setHasMore(result.pagination.page < result.pagination.totalPages);
    } catch {
      // ignore load more errors silently
    } finally {
      setIsLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [hasMore, isLoadingMore, page, limit, searchQuery]);

  /**
   * Optimistically update a conversation in the list
   * Updates UI immediately, then fetch from server in background
   */
  const updateConversationOptimistic = useCallback(
    (conversationId: string, updates: Partial<ConversationListItem>) => {
      // Immediate UI update
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, ...updates } : conv
        )
      );

      // Background fetch to sync with server (don't await to keep UI responsive)
      loadConversations(true).catch(() => {});
    },
    [loadConversations]
  );

  /**
   * Move a conversation to the top of the list (used after sending a message)
   * Optimistic update with smooth animation
   */
  const moveConversationToTop = useCallback((conversationId: string) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversationId);
      if (index === -1 || index === 0) return prev; // Already at top or not found

      const conversation = prev[index];
      // Update with current timestamp
      const updated = {
        ...conversation,
        updatedAt: new Date().toISOString(),
      };

      // Remove from current position and add to top
      const newList = [...prev];
      newList.splice(index, 1);
      newList.unshift(updated);

      return newList;
    });
  }, []);

  /**
   * Remove a conversation from the list (after delete)
   */
  const removeConversation = useCallback((conversationId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
  }, []);

  /**
   * Refresh conversations from server (full reload from page 1)
   */
  const refreshConversations = useCallback(async () => {
    // Force an immediate refresh even if a background fetch is in progress
    await loadConversations(true, true);
  }, [loadConversations]);

  // Auto-load on mount or when search changes
  useEffect(() => {
    loadConversations(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Listen for cross-tab events to keep conversation list in sync
  useEffect(() => {
    const handleCreated = (e: Event) => {
      try {
        const conversation = (e as CustomEvent).detail as ConversationListItem;
        if (!conversation) return;

        setConversations((prev) => {
          // If already exists, replace it; otherwise prepend
          const exists = prev.some((c) => c.id === conversation.id);
          if (exists) {
            return prev.map((c) =>
              c.id === conversation.id ? conversation : c
            );
          }
          return [conversation, ...prev];
        });

        // Background refresh to ensure consistency with server
        loadConversations(true).catch(() => {});
      } catch {
        // ignore non-fatal errors during cross-tab sync handling
        // logging removed
      }
    };

    const handleUpdated = (e: Event) => {
      try {
        const data = (e as CustomEvent).detail as {
          conversationId: string;
          update: Partial<ConversationListItem>;
        };
        if (!data || !data.conversationId) return;

        setConversations((prev) =>
          prev.map((c) =>
            c.id === data.conversationId ? { ...c, ...data.update } : c
          )
        );

        // Background refresh to ensure consistency
        loadConversations(true).catch(() => {});
      } catch {
        // ignore non-fatal errors during cross-tab sync handling
        // logging removed
      }
    };

    const handleDeleted = (e: Event) => {
      try {
        const data = (e as CustomEvent).detail as { conversationId: string };
        if (!data || !data.conversationId) return;

        setConversations((prev) =>
          prev.filter((c) => c.id !== data.conversationId)
        );

        // Background refresh to ensure consistency
        loadConversations(true).catch(() => {});
      } catch {
        // ignore non-fatal errors during cross-tab sync handling
        // logging removed
      }
    };

    const handleForceRefresh = () => {
      loadConversations(true).catch(() => {});
    };

    const handleActivity = (e: Event) => {
      try {
        const data = (e as CustomEvent).detail as {
          conversationId: string;
          lastActivity: string;
          messageCount: number;
          totalTokens: number;
        };
        if (!data || !data.conversationId) return;

        // Optimistically update conversation metadata and move to top
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === data.conversationId
              ? {
                  ...c,
                  message_count: data.messageCount,
                  total_tokens_used: data.totalTokens,
                  updatedAt: data.lastActivity,
                }
              : c
          );

          // Move the updated conversation to the top
          const targetIndex = updated.findIndex(
            (c) => c.id === data.conversationId
          );
          if (targetIndex > 0) {
            const targetConv = updated[targetIndex];
            updated.splice(targetIndex, 1);
            updated.unshift(targetConv);
          }

          return updated;
        });

        // Background refresh to ensure consistency
        loadConversations(true).catch(() => {});
      } catch {
        // logging removed
      }
    };

    window.addEventListener(
      "conversation:created",
      handleCreated as EventListener
    );
    window.addEventListener(
      "conversation:updated",
      handleUpdated as EventListener
    );
    window.addEventListener(
      "conversation:deleted",
      handleDeleted as EventListener
    );
    window.addEventListener(
      "conversation:activity",
      handleActivity as EventListener
    );
    window.addEventListener(
      "conversations:refresh",
      handleForceRefresh as EventListener
    );

    return () => {
      window.removeEventListener(
        "conversation:created",
        handleCreated as EventListener
      );
      window.removeEventListener(
        "conversation:updated",
        handleUpdated as EventListener
      );
      window.removeEventListener(
        "conversation:deleted",
        handleDeleted as EventListener
      );
      window.removeEventListener(
        "conversation:activity",
        handleActivity as EventListener
      );
      window.removeEventListener(
        "conversations:refresh",
        handleForceRefresh as EventListener
      );
    };
    // Depend on loadConversations to pick up latest function instance
  }, [loadConversations]);

  return {
    conversations,
    isLoading,
    isLoadingMore,
    hasMore,
    page,
    loadConversations,
    loadMore,
    updateConversationOptimistic,
    moveConversationToTop,
    removeConversation,
    refreshConversations,
  };
};
