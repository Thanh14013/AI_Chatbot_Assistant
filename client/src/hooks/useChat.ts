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
  loadConversations: (reset?: boolean) => Promise<void>;
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
    async (reset = false) => {
      // Prevent duplicate concurrent requests
      if (fetchingRef.current) return;

      const targetPage = reset ? 1 : page;

      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

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
      } catch (err) {
        console.error("Failed to load conversations", err);
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
    } catch (err) {
      console.error("Failed to load more conversations", err);
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
      loadConversations(true).catch((err) =>
        console.error("Background sync failed", err)
      );
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
    await loadConversations(true);
  }, [loadConversations]);

  // Auto-load on mount or when search changes
  useEffect(() => {
    loadConversations(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

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
