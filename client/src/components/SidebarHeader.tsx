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
import SearchDropdown, { SearchType } from "./SearchDropdown";
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
  onSearchTypeChange?: (type: SearchType) => void;
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
  onSearchTypeChange,
  onHighlightMessage,
  currentConversationId,
}) => {
  const navigate = useNavigate();
  const [localQuery, setLocalQuery] = useState(searchQuery || "");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<SearchType>("keyword");

  // keep localQuery in sync when parent clears
  useEffect(() => setLocalQuery(searchQuery || ""), [searchQuery]);

  // Notify parent when search type changes
  useEffect(() => {
    onSearchTypeChange?.(searchType);
  }, [searchType, onSearchTypeChange]);

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
      // Search based on selected type
      if (searchType === "tags") {
        // Tag-based search
        const normalizedQuery = trimmedQuery
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "");

        let tagResults: ConversationSearchResult[] = [];
        try {
          const { getConversations } = await import("../services/chat.service");
          const tagSearchRes = await getConversations({
            tags: [normalizedQuery],
            tagMode: "any",
            limit: 20,
            standalone: true, // Only search in standalone conversations (not in projects)
          });

          // Convert to search result format
          if (
            tagSearchRes.conversations &&
            tagSearchRes.conversations.length > 0
          ) {
            tagResults = tagSearchRes.conversations.map((conv) => ({
              conversation_id: conv.id,
              conversation_title: conv.title || "Untitled",
              message_count: conv.message_count || 0,
              updated_at:
                typeof conv.updatedAt === "string"
                  ? conv.updatedAt
                  : conv.updatedAt.toISOString(),
              max_similarity: 1.0,
              top_messages: [],
            }));
          }
        } catch (err) {
          console.warn("[Search] Tag search failed:", err);
          throw new Error("Tag search failed");
        }

        if (tagResults.length > 0) {
          setError(null);
          onSemanticResults?.(tagResults, trimmedQuery);

          // Removed auto-navigation - results will be displayed in sidebar
          return;
        } else {
          throw new Error("No conversations found with this tag");
        }
      } else {
        // Keyword search - semantic search
        const res = await searchAllConversations({
          query: trimmedQuery,
          limit: 10,
          messagesPerConversation: 2,
        });

        // Always surface the results to the header UI. If there are zero
        // results, present an empty list so the dropdown shows "Found 0".
        const results = res.results || [];
        setError(null);
        onSemanticResults?.(results, trimmedQuery);

        // Removed auto-navigation - results will be displayed in sidebar
      }
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
    searchType,
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

            {/* Search bar with dropdown + input */}
            <div className={styles.searchBar}>
              {/* Dropdown selector (Keyword/Tag) */}
              <SearchDropdown value={searchType} onChange={setSearchType} />

              {/* Search input field - press Enter to search */}
              <Input
                placeholder="Search…"
                value={localQuery}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                onPressEnter={handleSearch}
                className={styles.searchInput}
                allowClear
                bordered={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SidebarHeader;
