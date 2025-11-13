/**
 * Conversation List Cache Service
 * Client-side caching for conversation lists to improve sidebar performance
 */

import type { ConversationListItem } from "../types/chat.type";

interface ConversationListCacheEntry {
  conversations: ConversationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: number;
  searchQuery?: string; // Track if this was a search result
}

// Cache configuration
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes (shorter than messages since list changes more frequently)
const MAX_CACHE_ENTRIES = 5; // Cache multiple pages/searches

class ConversationCacheService {
  private cache: Map<string, ConversationListCacheEntry> = new Map();

  /**
   * Generate cache key
   */
  private getCacheKey(page: number, searchQuery?: string): string {
    return searchQuery ? `search:${searchQuery}:${page}` : `list:${page}`;
  }

  /**
   * Get cached conversation list
   */
  get(page: number, searchQuery?: string): ConversationListCacheEntry | null {
    const key = this.getCacheKey(page, searchQuery);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Set cached conversation list
   */
  set(
    page: number,
    conversations: ConversationListItem[],
    pagination: ConversationListCacheEntry["pagination"],
    searchQuery?: string
  ): void {
    const key = this.getCacheKey(page, searchQuery);

    this.cache.set(key, {
      conversations,
      pagination,
      timestamp: Date.now(),
      searchQuery,
    });

    // Evict oldest entries if exceeding limit
    if (this.cache.size > MAX_CACHE_ENTRIES) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = this.cache.size - MAX_CACHE_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Update a single conversation in all cached pages
   */
  updateConversation(
    conversationId: string,
    updates: Partial<ConversationListItem>
  ): void {
    this.cache.forEach((entry) => {
      const index = entry.conversations.findIndex(
        (c) => c.id === conversationId
      );
      if (index !== -1) {
        entry.conversations[index] = {
          ...entry.conversations[index],
          ...updates,
        };
      }
    });
  }

  /**
   * Add new conversation to page 1 caches
   */
  addConversation(conversation: ConversationListItem): void {
    this.cache.forEach((entry, key) => {
      // Only add to page 1 entries
      if (key.includes(":1") || key === "list:1") {
        entry.conversations.unshift(conversation);
        entry.pagination.total++;
      }
    });
  }

  /**
   * Remove conversation from all caches
   */
  removeConversation(conversationId: string): void {
    this.cache.forEach((entry) => {
      entry.conversations = entry.conversations.filter(
        (c) => c.id !== conversationId
      );
      entry.pagination.total--;
    });
  }

  /**
   * Invalidate specific page
   */
  invalidatePage(page: number, searchQuery?: string): void {
    const key = this.getCacheKey(page, searchQuery);
    this.cache.delete(key);
  }

  /**
   * Invalidate all search results
   */
  invalidateSearches(): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith("search:")) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    cachedConversations: number;
    cacheSize: string;
  } {
    let totalConversations = 0;
    this.cache.forEach((entry) => {
      totalConversations += entry.conversations.length;
    });

    const cacheSize = JSON.stringify(Array.from(this.cache.entries())).length;
    const sizeKB = (cacheSize / 1024).toFixed(2);

    return {
      totalEntries: this.cache.size,
      cachedConversations: totalConversations,
      cacheSize: `${sizeKB} KB`,
    };
  }
}

// Export singleton instance
export const conversationCacheService = new ConversationCacheService();
export default conversationCacheService;
