/**
 * Message Cache Service
 * Client-side caching for messages to improve performance
 * Uses in-memory cache with LRU eviction
 */

import { Message } from "../types/chat.type";

interface MessageCacheEntry {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  timestamp: number;
}

interface ConversationCache {
  [conversationId: string]: {
    [page: number]: MessageCacheEntry;
  };
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHED_CONVERSATIONS = 10; // Maximum conversations to cache
const MAX_CACHED_PAGES_PER_CONV = 3; // Maximum pages per conversation

class MessageCacheService {
  private cache: ConversationCache = {};
  private accessOrder: string[] = []; // LRU tracking

  /**
   * Get cached messages for a conversation page
   */
  get(conversationId: string, page: number): MessageCacheEntry | null {
    const convCache = this.cache[conversationId];
    if (!convCache) return null;

    const entry = convCache[page];
    if (!entry) return null;

    // Check if cache is expired
    const now = Date.now();
    if (now - entry.timestamp > CACHE_TTL) {
      delete convCache[page];
      return null;
    }

    // Update access order (LRU)
    this.updateAccessOrder(conversationId);

    return entry;
  }

  /**
   * Set cached messages for a conversation page
   */
  set(
    conversationId: string,
    page: number,
    messages: Message[],
    pagination: MessageCacheEntry["pagination"]
  ): void {
    // Ensure conversation cache exists
    if (!this.cache[conversationId]) {
      this.cache[conversationId] = {};
      this.updateAccessOrder(conversationId);
      this.evictIfNeeded();
    }

    // Cache the page data
    this.cache[conversationId][page] = {
      messages,
      pagination,
      timestamp: Date.now(),
    };

    // Evict old pages if exceeding limit
    const pages = Object.keys(this.cache[conversationId]).map(Number);
    if (pages.length > MAX_CACHED_PAGES_PER_CONV) {
      // Sort pages by timestamp (oldest first)
      pages.sort((a, b) => {
        const aTime = this.cache[conversationId][a].timestamp;
        const bTime = this.cache[conversationId][b].timestamp;
        return aTime - bTime;
      });

      // Remove oldest pages
      const toRemove = pages.length - MAX_CACHED_PAGES_PER_CONV;
      for (let i = 0; i < toRemove; i++) {
        delete this.cache[conversationId][pages[i]];
      }
    }
  }

  /**
   * Invalidate cache for a specific conversation
   */
  invalidate(conversationId: string): void {
    delete this.cache[conversationId];
    this.accessOrder = this.accessOrder.filter((id) => id !== conversationId);
  }

  /**
   * Invalidate cache for a specific page
   */
  invalidatePage(conversationId: string, page: number): void {
    const convCache = this.cache[conversationId];
    if (convCache) {
      delete convCache[page];
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache = {};
    this.accessOrder = [];
  }

  /**
   * Update message in cache (for real-time updates like pin/unpin)
   */
  updateMessage(
    conversationId: string,
    messageId: string,
    updates: Partial<Message>
  ): void {
    const convCache = this.cache[conversationId];
    if (!convCache) return;

    // Update message in all cached pages
    Object.keys(convCache).forEach((pageStr) => {
      const page = Number(pageStr);
      const entry = convCache[page];
      if (!entry) return;

      const messageIndex = entry.messages.findIndex((m) => m.id === messageId);
      if (messageIndex !== -1) {
        entry.messages[messageIndex] = {
          ...entry.messages[messageIndex],
          ...updates,
        };
      }
    });
  }

  /**
   * Add new message to cache (for optimistic updates)
   */
  addMessage(conversationId: string, message: Message): void {
    const convCache = this.cache[conversationId];
    if (!convCache) return;

    // Add to page 1 (most recent page)
    const page1 = convCache[1];
    if (page1) {
      page1.messages.push(message);
      page1.pagination.total++;
    }
  }

  /**
   * Remove message from cache
   */
  removeMessage(conversationId: string, messageId: string): void {
    const convCache = this.cache[conversationId];
    if (!convCache) return;

    // Remove from all cached pages
    Object.keys(convCache).forEach((pageStr) => {
      const page = Number(pageStr);
      const entry = convCache[page];
      if (!entry) return;

      entry.messages = entry.messages.filter((m) => m.id !== messageId);
      entry.pagination.total--;
    });
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(conversationId: string): void {
    // Remove from current position
    this.accessOrder = this.accessOrder.filter((id) => id !== conversationId);
    // Add to end (most recently used)
    this.accessOrder.push(conversationId);
  }

  /**
   * Evict least recently used conversations if exceeding limit
   */
  private evictIfNeeded(): void {
    while (this.accessOrder.length > MAX_CACHED_CONVERSATIONS) {
      const toRemove = this.accessOrder.shift();
      if (toRemove) {
        delete this.cache[toRemove];
      }
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats(): {
    cachedConversations: number;
    totalCachedPages: number;
    cacheSize: string;
  } {
    const cachedConversations = Object.keys(this.cache).length;
    let totalCachedPages = 0;

    Object.values(this.cache).forEach((convCache) => {
      totalCachedPages += Object.keys(convCache).length;
    });

    // Estimate cache size (rough calculation)
    const cacheSize = JSON.stringify(this.cache).length;
    const sizeKB = (cacheSize / 1024).toFixed(2);

    return {
      cachedConversations,
      totalCachedPages,
      cacheSize: `${sizeKB} KB`,
    };
  }
}

// Export singleton instance
export const messageCacheService = new MessageCacheService();
export default messageCacheService;
