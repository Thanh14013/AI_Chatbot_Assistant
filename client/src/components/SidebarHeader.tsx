import React, { useEffect, useState, useCallback } from "react";
import { Button, Input, Tooltip } from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import styles from "./SidebarHeader.module.css";
import {
  searchAllConversations,
  searchConversation,
  ConversationSearchResult,
} from "../services/searchService";

interface SidebarHeaderProps {
  onNewConversation: () => void;
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  collapsed?: boolean;
  onToggle?: () => void;
  // receives semantic search results (or null if cleared)
  onSemanticResults?: (results: ConversationSearchResult[] | null) => void;
  onHighlightMessage?: (messageId: string) => void;
  currentConversationId?: string | null;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  onNewConversation,
  searchQuery,
  onSearchChange,
  collapsed = false,
  onToggle,
  onSemanticResults,
  onHighlightMessage,
  currentConversationId,
}) => {
  const navigate = useNavigate();
  const [localQuery, setLocalQuery] = useState(searchQuery || "");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // keep localQuery in sync when parent clears
  useEffect(() => setLocalQuery(searchQuery || ""), [searchQuery]);

  // Manual search function - only called when user clicks search button
  const handleSearch = useCallback(async () => {
    const trimmedQuery = localQuery.trim();

    // Clear results if query is empty
    if (!trimmedQuery) {
      console.log("[SidebarHeader] Empty query, clearing results");
      onSemanticResults?.(null);
      setError(null);
      return;
    }

    console.log("[SidebarHeader] Starting semantic search for:", trimmedQuery);
    setIsSearching(true);
    setError(null);

    try {
      const res = await searchAllConversations({
        query: trimmedQuery,
        limit: 10,
        messagesPerConversation: 2,
      });

      console.log(
        "[SidebarHeader] Search successful, found",
        res.results?.length || 0,
        "conversations"
      );

      // Always surface the results to the header UI. If there are zero
      // results, present an empty list so the dropdown shows "Found 0".
      const results = res.results || [];
      setError(null);
      onSemanticResults?.(results);

      // Auto-navigate to the best matching conversation
      try {
        if (Array.isArray(results) && results.length > 0) {
          let bestConversationId: string | null = null;
          let bestSimilarity = -1;

          for (const conv of results) {
            const sim =
              typeof conv.max_similarity === "number"
                ? conv.max_similarity
                : -1;
            if (sim >= 0 && sim > bestSimilarity) {
              bestSimilarity = sim;
              bestConversationId = conv.conversation_id;
            }
          }

          if (bestConversationId) {
            if (
              currentConversationId === bestConversationId &&
              onHighlightMessage
            ) {
              // Already in the conversation, just highlight the message
              console.log(
                "[SidebarHeader] Already in conversation, searching and highlighting:",
                bestConversationId
              );
              try {
                const convRes = await searchConversation(bestConversationId, {
                  query: trimmedQuery,
                  limit: 1,
                });
                if (convRes.bestMatch?.message_id) {
                  onHighlightMessage(convRes.bestMatch.message_id);
                }
              } catch (searchErr) {
                console.debug(
                  "[SidebarHeader] Conversation search failed:",
                  searchErr
                );
              }
            } else {
              // Navigate to the conversation
              console.log(
                "[SidebarHeader] Auto-navigating to best conversation:",
                bestConversationId
              );
              const basePath = `/conversations/${bestConversationId}`;
              navigate(`${basePath}?q=${encodeURIComponent(trimmedQuery)}`);
            }
          }
        }
      } catch (navErr) {
        console.debug("[SidebarHeader] Auto-navigate failed:", navErr);
      }
    } catch (err: any) {
      console.error("[SidebarHeader] Semantic search failed:", err);
      const errorMsg =
        err.response?.data?.message || err.message || "Search failed";
      setError(errorMsg);
      onSemanticResults?.([]);
    } finally {
      setIsSearching(false);
    }
  }, [
    localQuery,
    onSemanticResults,
    navigate,
    onHighlightMessage,
    currentConversationId,
  ]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
    onSearchChange(e);
    // Clear semantic results when user clears input
    if (!e.target.value.trim()) {
      onSemanticResults?.(null);
      setError(null);
    }
  };

  // Handle clear
  const handleClear = () => {
    setLocalQuery("");
    onSearchChange({
      target: { value: "" },
    } as React.ChangeEvent<HTMLInputElement>);
    onSemanticResults?.(null);
    setError(null);
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };
  return (
    <div className={`${styles.header} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.headerTopRow}>
        {/* When collapsed, hide the New button and show only the toggle */}
        {!collapsed && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="middle"
            className={styles.newButton}
            onClick={onNewConversation}
          >
            New Conversation
          </Button>
        )}

        <Tooltip
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          placement="right"
        >
          <button
            className={styles.inlineToggle}
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <RightOutlined className={styles.toggleIcon} />
            ) : (
              <LeftOutlined className={styles.toggleIcon} />
            )}
          </button>
        </Tooltip>
      </div>

      {/* Hide search input when collapsed */}
      {!collapsed && (
        <div className={styles.searchContainer}>
          <Input
            placeholder="Search conversations..."
            prefix={<SearchOutlined />}
            value={localQuery}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className={styles.searchInput}
            size="middle"
            allowClear
            onClear={handleClear}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={isSearching}
            disabled={!localQuery.trim()}
            className={styles.searchButton}
            title="Search"
          >
            Search
          </Button>
        </div>
      )}

      {/* Error message */}
      {!collapsed && error && (
        <div className={styles.errorMessage}>⚠️ {error}</div>
      )}
    </div>
  );
};

export default SidebarHeader;
