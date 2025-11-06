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
  onSemanticResults?: (
    results: ConversationSearchResult[] | null,
    query?: string
  ) => void;
  onHighlightMessage?: (messageId: string) => void;
  currentConversationId?: string | null;
}

/**
 * Parse tags from query string
 * Examples:
 * - "khoa há»c vá»›i tag science" -> { keyword: "khoa há»c", tags: ["science"] }
 * - "Ä‘á»i sá»‘ng vá»›i tag life, study" -> { keyword: "Ä‘á»i sá»‘ng", tags: ["life", "study"] }
 * - "khoa há»c vá»›i tag " -> { keyword: "khoa há»c", tags: [] } (no tags, search all)
 * - "hello world" -> { keyword: "hello world", tags: [] }
 */
function parseQueryWithTags(query: string): {
  keyword: string;
  tags: string[];
} {
  // Match pattern: "vá»›i tag <tag1>, <tag2>, ..." (optional tags after "tag")
  // Support both "vá»›i tag" and "voi tag" (without diacritics)
  const tagPattern = /\s+v[oá»›]i\s+tag\s*([a-zA-Z0-9\s,\-_]*)$/i;
  const match = query.match(tagPattern);

  if (match) {
    const keyword = query.slice(0, match.index).trim();
    const tagsString = match[1]?.trim() || "";

    // Only parse tags if there's actual content after "tag"
    const tags =
      tagsString.length > 0
        ? tagsString
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag.length > 0)
        : [];

    return { keyword, tags };
  }

  return { keyword: query.trim(), tags: [] };
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
      onSemanticResults?.(null, "");
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Parse query to extract keyword and tags
      const { keyword, tags } = parseQueryWithTags(trimmedQuery);

      // Perform semantic search with optional tag filtering
      const res = await searchAllConversations({
        query: keyword || trimmedQuery, // Use keyword if parsed, otherwise full query
        tags: tags.length > 0 ? tags : undefined, // Only include tags if found
        limit: 10,
        messagesPerConversation: 2,
      });

      // Always surface the results to the header UI. If there are zero
      // results, present an empty list so the dropdown shows "Found 0".
      const results = res.results || [];
      setError(null);
      onSemanticResults?.(results, trimmedQuery);

      // Removed auto-navigation - results will be displayed in sidebar
    } catch (err: any) {
      // logging removed: semantic search failed
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
      onSemanticResults?.(null, "");
      setError(null);
    }
  };

  // Handle clear
  const handleClear = () => {
    setLocalQuery("");
    onSearchChange({
      target: { value: "" },
    } as React.ChangeEvent<HTMLInputElement>);
    onSemanticResults?.(null, "");
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
      {/* Single horizontal row with all controls */}
      <div className={styles.headerRow}>
        {/* Toggle sidebar button (menu icon) */}
        <Tooltip
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          placement="right"
        >
          <button
            className={styles.toggleButton}
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

        {!collapsed && (
          <>
            {/* New Conversation button - small, blue, rounded */}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className={styles.newButton}
              onClick={onNewConversation}
              title="New Conversation"
            />

            {/* Search bar with input */}
            <div className={styles.searchBar}>
              {/* Search input field - press Enter to search */}
              <Input
                placeholder="Search (e.g., 'khoa há»c vá»›i tag science')â€¦"
                value={localQuery}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                onPressEnter={handleSearch}
                className={styles.searchInput}
                allowClear
                bordered={false}
                prefix={<SearchOutlined />}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SidebarHeader;
