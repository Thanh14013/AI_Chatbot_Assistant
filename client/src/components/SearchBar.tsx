import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  searchAllConversations,
  ConversationSearchResult,
} from "../services/searchService";
import styles from "./SearchBar.module.css";

interface SearchBarProps {
  onResultClick?: (conversationId: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onResultClick }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConversationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const data = await searchAllConversations({
        query,
        limit: 10,
        messagesPerConversation: 3,
      });
      setResults(data.results);
      setIsExpanded(true);

      // Find overall best message match across returned conversations and
      // navigate to it (with highlight) similar to conversation-level search.
      try {
        if (
          !onResultClick &&
          Array.isArray(data.results) &&
          data.results.length
        ) {
          let bestConversationId: string | null = null;
          let bestMessageId: string | null = null;
          let bestSimilarity = -1;

          for (const conv of data.results) {
            const top = conv.top_messages && conv.top_messages[0];
            const sim =
              top && typeof top.similarity === "number"
                ? top.similarity
                : typeof conv.max_similarity === "number"
                ? conv.max_similarity
                : -1;
            const mid = top ? top.message_id : undefined;
            if (typeof sim === "number" && sim >= 0 && mid) {
              if (sim > bestSimilarity) {
                bestSimilarity = sim;
                bestConversationId = conv.conversation_id;
                bestMessageId = mid;
              }
            }
          }

          if (bestConversationId) {
            // Navigate to the conversation first, then the conversation page will
            // handle calling the conversation-local search API if needed (via ?q param).
            const basePath = `/conversations/${bestConversationId}`;
            navigate(`${basePath}?q=${encodeURIComponent(query)}`);
          }
        }
      } catch {
        // non-fatal: navigation failure should not break search UI
        // logging removed
      }
    } catch (err: any) {
      // logging removed: search failed
      setError(err.response?.data?.message || "Search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleResultClick = (
    conversationId: string,
    highlightMessageId?: string
  ) => {
    if (onResultClick) {
      onResultClick(conversationId);
    } else {
      // Navigate to conversation route and include highlight query param when available
      const basePath = `/conversations/${conversationId}`;
      if (highlightMessageId) {
        navigate(
          `${basePath}?highlight=${encodeURIComponent(highlightMessageId)}`
        );
      } else {
        navigate(basePath);
      }
    }
    setIsExpanded(false);
    setQuery("");
    setResults([]);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setIsExpanded(false);
  };

  return (
    <div className={styles.searchBar} ref={searchRef}>
      <div className={styles.inputContainer}>
        <input
          type="text"
          placeholder="Search conversations..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          onFocus={() =>
            query.trim() && results.length > 0 && setIsExpanded(true)
          }
          className={styles.input}
        />
        {query && (
          <button
            onClick={handleClear}
            className={styles.clearButton}
            title="Clear"
          >
            ✕
          </button>
        )}
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className={styles.searchButton}
          title="Search"
        >
          {isSearching ? "⏳" : "🔍"}
        </button>
      </div>

      {isExpanded && (
        <>
          {error && (
            <div className={styles.error}>
              <span>⚠️ {error}</span>
            </div>
          )}

          {results.length > 0 && (
            <div className={styles.results}>
              <div className={styles.resultsHeader}>
                Found {results.length} conversation
                {results.length > 1 ? "s" : ""}
              </div>
              {results.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className={styles.resultItem}
                  onClick={() =>
                    handleResultClick(
                      conv.conversation_id,
                      conv.top_messages && conv.top_messages[0]
                        ? conv.top_messages[0].message_id
                        : undefined
                    )
                  }
                >
                  <div className={styles.resultTitle}>
                    {conv.conversation_title}
                  </div>
                  <div className={styles.resultMeta}>
                    <span className={styles.resultSimilarity}>
                      {(conv.max_similarity * 100).toFixed(0)}% similarity
                    </span>
                    <span className={styles.resultCount}>
                      {conv.message_count} message
                      {conv.message_count > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className={styles.resultMessages}>
                    {conv.top_messages.slice(0, 2).map((msg) => (
                      <div
                        key={msg.message_id}
                        className={styles.messagePreview}
                      >
                        <span className={styles.role}>{msg.role}:</span>
                        <span className={styles.content}>
                          {msg.content.substring(0, 80)}
                          {msg.content.length > 80 ? "..." : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!error && !isSearching && query.trim() && results.length === 0 && (
            <div className={styles.noResults}>
              <span>No results found for "{query}"</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
