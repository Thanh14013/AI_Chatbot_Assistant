import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  SearchOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import {
  searchConversation,
  SearchMatchWithContext,
  ContextMessage,
} from "../services/searchService";
import styles from "./ConversationSearch.module.css";

interface ConversationSearchProps {
  conversationId: string;
  onResultClick: (
    messageId: string,
    match?: SearchMatchWithContext["match"],
    context?: { before: ContextMessage[]; after: ContextMessage[] }
  ) => void;
}

export const ConversationSearch: React.FC<ConversationSearchProps> = ({
  conversationId,
  onResultClick,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMatchWithContext[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInputVisible, setIsInputVisible] = useState(false);
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
      const data = await searchConversation(conversationId, {
        query,
        limit: 5,
        contextMessages: 2,
      });
      setResults(data.results);
      setIsExpanded(true);

      // Auto-scroll to best match with context if available
      if (data.bestMatch) {
        const best = data.results.find(
          (r) => r.match.message_id === data.bestMatch!.message_id
        );
        onResultClick(data.bestMatch.message_id, data.bestMatch, {
          before: best?.contextBefore ?? [],
          after: best?.contextAfter ?? [],
        });
      }
    } catch (err: any) {
      // logging removed: conversation search failed
      setError(err.response?.data?.message || "Search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [conversationId, query, onResultClick]);

  const handleResultClick = (messageId: string) => {
    const res = results.find((r) => r.match.message_id === messageId);
    onResultClick(messageId, res?.match, {
      before: res?.contextBefore ?? [],
      after: res?.contextAfter ?? [],
    });
    setIsExpanded(false);
  };

  const handleSearchButtonClick = () => {
    setIsInputVisible(true);
  };

  const handleInputBlur = () => {
    // Hide input if no query and not searching
    if (!query.trim() && !isSearching) {
      setIsInputVisible(false);
      setIsExpanded(false);
      setResults([]);
      setError(null);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setIsExpanded(false);
  };

  return (
    <div className={styles.conversationSearch} ref={searchRef}>
      <div className={styles.inputContainer}>
        {isInputVisible ? (
          <>
            <input
              type="text"
              placeholder="Search in conversation..."
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                // hide old results immediately while typing
                setQuery(v);
                setIsExpanded(false);
                setResults([]);
                setError(null);
              }}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              onBlur={handleInputBlur}
              className={styles.input}
              autoFocus
            />
            {query && (
              <button
                onClick={handleClear}
                className={styles.clearButton}
                title="Clear"
              >
                <CloseOutlined />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleSearchButtonClick}
            className={styles.searchButton}
            title="Search in conversation"
          >
            <SearchOutlined />
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {error && (
            <div className={styles.error}>
              <ExclamationCircleOutlined style={{ marginRight: 8 }} />
              <span>{error}</span>
            </div>
          )}

          {results.length > 0 ? (
            <div className={styles.results}>
              <div className={styles.resultsHeader}>
                Found {results.length} result{results.length > 1 ? "s" : ""}
              </div>
              {results.map((result, idx) => (
                <div
                  key={result.match.message_id}
                  className={styles.resultItem}
                  onClick={() => handleResultClick(result.match.message_id)}
                >
                  <div className={styles.resultHeader}>
                    <span className={styles.role}>{result.match.role}</span>
                  </div>
                  <div className={styles.matchContent}>
                    {result.match.content.length > 150
                      ? `${result.match.content.substring(0, 150)}...`
                      : result.match.content}
                  </div>
                  {/* context and similarity intentionally hidden for simpler UI */}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noResults}>
              <span>No results found for "{query}"</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
