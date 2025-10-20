import React, { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "antd";
import { useAuth } from "../hooks";
import { getConversations } from "../services/chat.service";
import type { ConversationListItem } from "../types/chat.type";
import SidebarHeader from "./SidebarHeader";
import ConversationList from "./ConversationList";
import UserSection from "./UserSection";
import { SearchBar } from "./SearchBar";
import styles from "./Sidebar.module.css";

const { Sider } = Layout;

interface SidebarProps {
  currentConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onHighlightMessage?: (messageId: string) => void;
  unreadConversations?: Set<string>; // For unread tracking (multi-tab)
  onSettingsClick?: () => void; // Add settings callback
  onProfileClick?: () => void; // Add profile callback
}

const Sidebar: React.FC<SidebarProps> = ({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onHighlightMessage,
  unreadConversations,
  onSettingsClick,
  onProfileClick,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [filteredConversations, setFilteredConversations] = useState<
    ConversationListItem[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  // semantic search results returned from header (optional)
  const [semanticResults, setSemanticResults] = useState<
    import("../services/searchService").ConversationSearchResult[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load conversations from API (guard concurrent calls with a ref)
  const loadingRef = useRef(false);
  const loadConversations = useCallback(
    async (opts: { reset?: boolean; page?: number } = {}) => {
      const targetPage = opts.page || (opts.reset ? 1 : page);
      if (loadingRef.current) return;

      // If resetting, show main loader; otherwise show loading more
      if (opts.reset) {
        setIsLoading(true);
        setPage(1);
      } else {
        setIsLoadingMore(true);
      }

      loadingRef.current = true;
      setError(null);

      try {
        const result = await getConversations({ limit: 20, page: targetPage });
        // sort by updatedAt desc
        const sorted = (result.conversations || []).slice().sort((a, b) => {
          const ta = new Date(a.updatedAt).getTime();
          const tb = new Date(b.updatedAt).getTime();
          return tb - ta;
        });

        if (opts.reset || targetPage === 1) {
          setConversations(sorted);
          setFilteredConversations(sorted);
        } else {
          setConversations((prev) => [...prev, ...sorted]);
          setFilteredConversations((prev) => [...prev, ...sorted]);
        }

        setPage(result.pagination.page);
        setHasMore(result.pagination.page < result.pagination.totalPages);
      } catch (err) {
        setError("Failed to load conversations");
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [page]
  );

  // Initial load
  useEffect(() => {
    loadConversations({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMoreConversations = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    await loadConversations({ page: page + 1 });
  }, [hasMore, isLoadingMore, loadConversations, page]);

  // Determine which conversations to show in the sidebar.
  // Only use semantic search results provided by the header. Do NOT
  // perform any client-side filtering by conversation title here — the
  // global search is semantic-only per product decision.
  useEffect(() => {
    if (semanticResults && semanticResults.length > 0) {
      const mapped = semanticResults.map((r) => ({
        id: r.conversation_id,
        title: r.conversation_title,
        message_count: r.message_count,
        updatedAt: r.updated_at,
        hasUnread: unreadConversations?.has(r.conversation_id) || false,
      })) as ConversationListItem[];
      setFilteredConversations(mapped);
      return;
    }

    // Otherwise show the full conversations list (no local title filtering)
    // Add hasUnread status based on unreadConversations Set
    const withUnread = conversations.map((conv) => ({
      ...conv,
      hasUnread: unreadConversations?.has(conv.id) || false,
    }));
    setFilteredConversations(withUnread);
  }, [conversations, semanticResults, unreadConversations]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleNewConversation = () => {
    try {
      const res = onNewConversation?.();
      // If parent returns a promise, refresh after it resolves
      if (res && typeof (res as any).then === "function") {
        (res as Promise<any>).finally(() => loadConversations());
      } else {
        // otherwise trigger immediate refresh
        loadConversations();
      }
    } catch (err) {
      // ensure we still try to refresh
      loadConversations();
    }
  };

  // Listen to global events to refresh the conversations list
  useEffect(() => {
    const onRefresh = () => loadConversations();
    const onMessageSent = () => loadConversations();

    window.addEventListener("conversations:refresh", onRefresh);
    window.addEventListener("message:sent", onMessageSent);

    return () => {
      window.removeEventListener("conversations:refresh", onRefresh);
      window.removeEventListener("message:sent", onMessageSent);
    };
  }, [loadConversations]);

  const handleSelectConversation = (id: string) => {
    onSelectConversation?.(id);
  };

  return (
    <Sider
      trigger={null}
      width={collapsed ? 72 : 320}
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
    >
      {/* Header Section */}
      <div className={styles.headerSection}>
        <SidebarHeader
          onNewConversation={handleNewConversation}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          // receive semantic search results from header
          onSemanticResults={(results) => setSemanticResults(results)}
          onHighlightMessage={onHighlightMessage}
          currentConversationId={currentConversationId}
        />
      </div>

      {/* Middle Section - Scrollable Conversations */}
      <div className={styles.middleSection}>
        <ConversationList
          conversations={filteredConversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          isLoading={isLoading}
          error={error}
          searchQuery={searchQuery}
          onRefresh={() => loadConversations({ reset: true })}
          onLoadMore={loadMoreConversations}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          collapsed={collapsed}
        />
      </div>

      {/* Bottom Section - User Info */}
      <div className={styles.bottomSection}>
        <UserSection
          user={user}
          collapsed={collapsed}
          onSettingsClick={onSettingsClick}
          onProfileClick={onProfileClick}
        />
      </div>
    </Sider>
  );
};

export default Sidebar;
