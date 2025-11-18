import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Layout, App } from "antd";
import { useAuth, useDebounce } from "../hooks";
import { getConversations } from "../services/chat.service";
import { moveConversationToProject } from "../services/project.service";
import { useSidebarStore } from "../stores/sidebar.store";
import type { ConversationListItem } from "../types/chat.type";
import type { DragDropState } from "../types/drag-drop.type";
import SidebarHeader from "./SidebarHeader";
import ConversationList from "./ConversationList";
import ProjectSection from "./ProjectSection";
import UserSection from "./UserSection";
import { SearchBar } from "./SearchBar";
import { SearchResultsList } from "./SearchResultsList";
import { useNavigate } from "react-router-dom";
import { rafThrottle } from "../utils/performance.util";
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
  onMemoryClick?: () => void; // Add memory dashboard callback
}

const Sidebar: React.FC<SidebarProps> = ({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onHighlightMessage,
  unreadConversations,
  onSettingsClick,
  onProfileClick,
  onMemoryClick,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message: antdMessage } = App.useApp();

  // 🚀 USE CENTRALIZED SIDEBAR STORE
  const sidebarStore = useSidebarStore();

  // Local UI state
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  // semantic search results returned from header (optional)
  const [semanticResults, setSemanticResults] = useState<
    import("../services/searchService").ConversationSearchResult[] | null
  >(null);
  const [currentSearchQuery, setCurrentSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 🚀 PERFORMANCE: Update searchQuery only when debounced value changes
  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch]);

  // 🚀 GET CONVERSATIONS FROM STORE (Single Source of Truth)
  const conversations = sidebarStore.allStandaloneConversations;
  const [filteredConversations, setFilteredConversations] = useState<
    ConversationListItem[]
  >([]);

  // Drag and drop state
  const [dragDropState, setDragDropState] = useState<DragDropState>({
    draggedItem: null,
    dropTarget: null,
    isDragging: false,
  });

  // Load conversations from API (guard concurrent calls with a ref)
  const loadingRef = useRef(false);
  const loadConversations = useCallback(
    async (opts: { reset?: boolean; page?: number } = {}) => {
      const targetPage = opts.page || (opts.reset ? 1 : page);
      if (loadingRef.current) return;

      // If resetting, show main loader; otherwise show loading more
      if (opts.reset) {
        sidebarStore.setLoading(true);
        setPage(1);
      } else {
        setIsLoadingMore(true);
      }

      loadingRef.current = true;
      sidebarStore.setError(null);

      try {
        const result = await getConversations({
          limit: 20,
          page: targetPage,
          standalone: true, // Only fetch conversations without project_id
        });

        const standaloneConversations = result.conversations || [];

        // 🚀 UPDATE CENTRALIZED STORE
        if (opts.reset || targetPage === 1) {
          // On reset/first page: only set standalone conversations, don't touch project conversations
          const existingProjectConvs = Array.from(
            sidebarStore.conversations.values()
          ).filter((c) => c.project_id !== null);
          const allConvs = [
            ...standaloneConversations,
            ...existingProjectConvs,
          ];
          sidebarStore.setConversations(allConvs);
        } else {
          // For pagination: merge new standalone conversations
          sidebarStore.addConversations(standaloneConversations);
        }

        setPage(result.pagination.page);
        setHasMore(result.pagination.page < result.pagination.totalPages);
      } catch (err) {
        sidebarStore.setError("Failed to load conversations");
      } finally {
        loadingRef.current = false;
        sidebarStore.setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [page, sidebarStore]
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
  // perform any client-side filtering by conversation title here â€” the
  // global search is semantic-only per product decision.
  useEffect(() => {
    if (semanticResults && semanticResults.length > 0) {
      const mapped = semanticResults.map((r) => ({
        id: r.conversation_id,
        title: r.conversation_title,
        message_count: r.message_count,
        updatedAt: r.updated_at,
        hasUnread: unreadConversations?.has(r.conversation_id) || false,
        // Preserve other fields from original conversation if available
        model: conversations.find((c) => c.id === r.conversation_id)?.model,
        context_window: conversations.find((c) => c.id === r.conversation_id)
          ?.context_window,
        tags: conversations.find((c) => c.id === r.conversation_id)?.tags || [],
      })) as ConversationListItem[];
      setFilteredConversations(mapped);
      return;
    }

    // Otherwise show the full conversations list (no local title filtering)
    // Add hasUnread status based on unreadConversations Set
    const withUnread = conversations.map((conv) => {
      return {
        ...conv,
        hasUnread: unreadConversations?.has(conv.id) || false,
      };
    });
    setFilteredConversations(withUnread);
  }, [conversations, semanticResults, unreadConversations]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value); // 🚀 PERFORMANCE: Update input immediately for responsive UI
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

    // Listen for conversation:moved events (from WebSocket or local)
    const onConversationMoved = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { conversationId, oldProjectId, newProjectId } = detail;

      // If moved TO "All Conversations" (newProjectId = null), reload to show it
      if (newProjectId === null) {
        loadConversations({ reset: true });
      } else {
        // If moved FROM "All Conversations" to a project, update store
        sidebarStore.updateConversationOptimistic(conversationId, {
          project_id: newProjectId,
        });
        // Also update filtered list
        setFilteredConversations((prev) =>
          prev.filter((c) => c.id !== conversationId)
        );
      }
    };

    window.addEventListener("conversations:refresh", onRefresh);
    window.addEventListener("message:sent", onMessageSent);
    window.addEventListener("conversation:moved", onConversationMoved);

    return () => {
      window.removeEventListener("conversations:refresh", onRefresh);
      window.removeEventListener("message:sent", onMessageSent);
      window.removeEventListener("conversation:moved", onConversationMoved);
    };
  }, [loadConversations]);

  const handleSelectConversation = (id: string) => {
    onSelectConversation?.(id);
  };

  // ===== Drag and Drop Handlers =====

  /**
   * Handle conversation drag start
   */
  const handleConversationDragStart = (
    conversationId: string,
    sourceProjectId: string | null
  ) => {
    setDragDropState({
      draggedItem: { conversationId, sourceProjectId },
      dropTarget: null,
      isDragging: true,
    });
  };

  /**
   * Handle conversation drag end
   */
  const handleConversationDragEnd = () => {
    setDragDropState({
      draggedItem: null,
      dropTarget: null,
      isDragging: false,
    });
  };

  /**
   * Handle drag over project - throttled for performance
   */
  const handleProjectDragOver = useMemo(
    () =>
      rafThrottle((projectId: string, isValid: boolean) => {
        setDragDropState((prev) => {
          // Validate: cannot drop on same project
          const sourceProjectId = prev.draggedItem?.sourceProjectId;
          const actualIsValid = sourceProjectId !== projectId;

          return {
            ...prev,
            dropTarget: {
              projectId,
              isValid: actualIsValid,
              type: "project",
            },
          };
        });
      }),
    []
  );

  /**
   * 🚀 OPTIMIZED: Handle drop on project with INSTANT UI update + Store integration
   * Uses centralized store with optimistic updates and transaction rollback
   */
  const handleProjectDrop = async (
    projectId: string,
    conversationId: string,
    sourceProjectId: string | null
  ) => {
    // Validate drop (can't drop on same project)
    if (sourceProjectId === projectId) {
      antdMessage.warning("Conversation is already in this project");
      handleConversationDragEnd();
      return;
    }

    // 🔥 STEP 1: Optimistic update via store - UI changes INSTANTLY
    const transactionId = sidebarStore.moveConversationOptimistic(
      conversationId,
      sourceProjectId,
      projectId
    );

    // 🔥 STEP 2: Clear drag state immediately (smooth UX)
    handleConversationDragEnd();

    // 🔥 STEP 3: Dispatch event IMMEDIATELY for cross-component sync
    window.dispatchEvent(
      new CustomEvent("conversation:moved", {
        detail: {
          conversationId,
          oldProjectId: sourceProjectId,
          newProjectId: projectId,
        },
      })
    );

    // 🔥 STEP 4: API call in background (fire-and-forget)
    moveConversationToProject(conversationId, projectId)
      .then(() => {
        // Success: Commit transaction
        sidebarStore.commitTransaction(transactionId);
        antdMessage.success("Conversation moved to project", 2);
      })
      .catch(async (err: any) => {
        // 🔄 ROLLBACK: Restore state if API fails
        sidebarStore.rollbackTransaction(transactionId);
        antdMessage.error(err?.message || "Failed to move conversation");

        // Re-dispatch rollback event
        window.dispatchEvent(
          new CustomEvent("conversation:moved", {
            detail: {
              conversationId,
              oldProjectId: projectId,
              newProjectId: sourceProjectId,
            },
          })
        );
      });
  };
  /**
   * Handle drag over "All Conversations" section - throttled
   */
  const handleAllConversationsDragOver = useMemo(
    () =>
      rafThrottle(() => {
        setDragDropState((prev) => {
          const isValid = !!prev.draggedItem?.sourceProjectId;
          return {
            ...prev,
            dropTarget: {
              projectId: null,
              isValid,
              type: "all-conversations",
            },
          };
        });
      }),
    []
  );

  /**
   * 🚀 OPTIMIZED: Handle drop on "All Conversations" with INSTANT UI update + Store
   * Uses centralized store with optimistic updates and transaction rollback
   */
  const handleAllConversationsDrop = async (
    conversationId: string,
    sourceProjectId: string | null
  ) => {
    // Only allow if coming from a project
    if (!sourceProjectId) {
      antdMessage.warning("Conversation is already in All Conversations");
      handleConversationDragEnd();
      return;
    }

    // 🔥 STEP 1: Optimistic update via store - INSTANT feedback
    const transactionId = sidebarStore.moveConversationOptimistic(
      conversationId,
      sourceProjectId,
      null
    );

    // 🔥 STEP 2: Clear drag state immediately
    handleConversationDragEnd();

    // 🔥 STEP 3: Dispatch event IMMEDIATELY
    window.dispatchEvent(
      new CustomEvent("conversation:moved", {
        detail: {
          conversationId,
          oldProjectId: sourceProjectId,
          newProjectId: null,
        },
      })
    );

    // 🔥 STEP 4: API call in background (fire-and-forget)
    moveConversationToProject(conversationId, null)
      .then(() => {
        sidebarStore.commitTransaction(transactionId);
        antdMessage.success("Moved to All Conversations", 2);
      })
      .catch(async (err: any) => {
        // 🔄 ROLLBACK on error
        sidebarStore.rollbackTransaction(transactionId);
        antdMessage.error(err?.message || "Failed to move conversation");

        // Re-dispatch rollback event
        window.dispatchEvent(
          new CustomEvent("conversation:moved", {
            detail: {
              conversationId,
              oldProjectId: null,
              newProjectId: sourceProjectId,
            },
          })
        );
      });
  };
  /**
   * Handle drag leave (clear drop target)
   */
  const handleDragLeave = () => {
    setDragDropState((prev) => ({
      ...prev,
      dropTarget: null,
    }));
  };

  return (
    <Sider
      trigger={null}
      width={collapsed ? 60 : 260}
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
    >
      {/* Header Section */}
      <div className={styles.headerSection}>
        <SidebarHeader
          onNewConversation={handleNewConversation}
          searchQuery={searchInput} // 🚀 PERFORMANCE: Pass immediate value for responsive input
          onSearchChange={handleSearchChange}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          // receive semantic search results from header
          onSemanticResults={(results, query) => {
            setSemanticResults(results);
            setCurrentSearchQuery(query || "");
          }}
          onHighlightMessage={onHighlightMessage}
          currentConversationId={currentConversationId}
        />
      </div>

      {/* Middle Section - Scrollable Conversations */}
      <div className={styles.middleSection}>
        {/* 🚀 OPTIMIZATION: Always render ProjectSection, hide with CSS to prevent unmount/remount */}
        <div
          className={`${styles.projectsContainer} ${
            collapsed ? styles.hidden : ""
          }`}
        >
          <ProjectSection
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            currentConversationId={currentConversationId || undefined}
            onDragStart={handleConversationDragStart}
            onDragEnd={handleConversationDragEnd}
            onDragOver={handleProjectDragOver}
            onDrop={handleProjectDrop}
            onDragLeave={handleDragLeave}
            draggedConversationId={
              dragDropState.draggedItem?.conversationId || null
            }
            dropTargetProjectId={dragDropState.dropTarget?.projectId || null}
            isDropTargetValid={dragDropState.dropTarget?.isValid || false}
          />
        </div>
        {!semanticResults ? (
          <ConversationList
            conversations={filteredConversations}
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            isLoading={sidebarStore.isLoading}
            error={sidebarStore.error}
            searchQuery={searchQuery}
            onRefresh={() => loadConversations({ reset: true })}
            onLoadMore={loadMoreConversations}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            collapsed={collapsed}
            onDragOver={handleAllConversationsDragOver}
            onDrop={handleAllConversationsDrop}
            onDragLeave={handleDragLeave}
            isDropTarget={
              dragDropState.dropTarget?.type === "all-conversations"
            }
            draggedConversationId={
              dragDropState.draggedItem?.conversationId || null
            }
            onConversationDragStart={handleConversationDragStart}
            onConversationDragEnd={handleConversationDragEnd}
          />
        ) : (
          <SearchResultsList
            results={semanticResults.map((result) => ({
              result,
              tags:
                conversations.find((c) => c.id === result.conversation_id)
                  ?.tags || [],
            }))}
            query={currentSearchQuery}
            onMessageClick={(conversationId, messageId) => {
              // Navigate to conversation and highlight message (if messageId provided)
              const url = messageId
                ? `/conversations/${conversationId}?highlight=${messageId}`
                : `/conversations/${conversationId}`;
              navigate(url);
            }}
          />
        )}
      </div>

      {/* Bottom Section - User Info */}
      <div className={styles.bottomSection}>
        <UserSection
          user={user}
          collapsed={collapsed}
          onSettingsClick={onSettingsClick}
          onProfileClick={onProfileClick}
          onMemoryClick={onMemoryClick}
        />
      </div>
    </Sider>
  );
};

export default Sidebar;
