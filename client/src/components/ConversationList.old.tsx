import React from "react";
import {
  Spin,
  Button,
  Empty,
  App,
} from "antd";
import {
  MessageOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import ConversationItem from "./ConversationItem";
import type { ConversationListItem } from "../types/chat.type";
import styles from "./ConversationList.module.css";

// Remove unused ConversationItemActions component
const { useApp } = App;

interface ConversationListProps {
  conversations: ConversationListItem[];
  currentConversationId?: string | null;
  onSelectConversation: (id: string) => void;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  onRefresh: () => void;
  onLoadMore?: () => Promise<void> | void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  collapsed?: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  isLoading,
  error,
  searchQuery,
  onRefresh,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  collapsed = false,
}) => {
  const navigate = useNavigate();
  // State for edit modal (single shared modal)
  const [editModal, setEditModal] = React.useState<{
    visible: boolean;
    conversation: ConversationListItem | null;
  }>({ visible: false, conversation: null });

  // State for delete confirmation modal (controlled, avoid Modal.confirm static API)
  const [deleteModal, setDeleteModal] = React.useState<{
    visible: boolean;
    id: string | null;
    title: string;
  }>({ visible: false, id: null, title: "" });

  // Track which conversation is currently processing an action (edit/delete)
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const openEdit = (
    conversation: ConversationListItem,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setEditModal({
      visible: true,
      conversation,
    });
  };

  const handleEditSubmit = async (values: ConversationFormValues) => {
    const conversation = editModal.conversation;
    if (!conversation) return;

    setProcessingId(conversation.id);
    try {
      await updateConversation(conversation.id, values);
      setEditModal({ visible: false, conversation: null });
      onRefresh();
      message.success("Conversation updated");

      // Notify WebSocket for multi-tab sync
      if (websocketService.isConnected()) {
        try {
          websocketService.notifyConversationUpdated(conversation.id, {
            ...values,
            updatedAt: new Date().toISOString(),
          });
        } catch {}
      }
    } catch (err) {
      message.error("Failed to update conversation");
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditModal({ visible: false, conversation: null });
  };

  const openDelete = (
    conversation: ConversationListItem,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setDeleteModal({
      visible: true,
      id: conversation.id,
      title: conversation.title || "Untitled",
    });
  };

  const confirmDelete = async () => {
    const id = deleteModal.id;
    if (!id) return;

    setProcessingId(id);
    try {
      await deleteConversation(id);
      setDeleteModal({ visible: false, id: null, title: "" });

      // Notify WebSocket for multi-tab sync
      if (websocketService.isConnected()) {
        try {
          websocketService.notifyConversationDeleted(id);
        } catch {}
      }

      // Refresh conversations list (await if it returns a Promise)
      try {
        const maybe: any = onRefresh?.();
        if (maybe && typeof maybe.then === "function") {
          await maybe;
        }
      } catch {}

      // Redirect to home after deletion (replace history so back doesn't return)
      try {
        // logging removed: deleting conversation succeeded, navigating to /
        navigate("/", { replace: true });
        // Fallback in case navigate didn't change the location (rare)
        setTimeout(() => {
          if (window.location.pathname !== "/") {
            window.location.href = "/";
          }
        }, 120);
      } catch (e) {
        // Final fallback
        setTimeout(() => {
          window.location.href = "/";
        }, 120);
      }
      message.success("Conversation deleted");
    } catch (err) {
      message.error("Failed to delete conversation");
    } finally {
      setProcessingId(null);
    }
  };

  const cancelDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteModal({ visible: false, id: null, title: "" });
  };

  // Format time display
  const formatTime = (dateString: string | Date) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours =
      Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <div className={styles.errorState}>
        <span className={styles.emptyText}>{error}</span>
        <Button
          type="link"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          className={styles.retryButton}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading && conversations.length === 0) {
    return (
      <div className={styles.loadingState}>
        <Spin
          indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
          tip="Loading conversations..."
        />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Empty
          image={<MessageOutlined className={styles.emptyIcon} />}
          description={
            <div>
              <span className={styles.emptyText}>
                {searchQuery
                  ? "No conversations found"
                  : "No conversations yet"}
              </span>
              <br />
              <span className={styles.emptySubtext}>
                {searchQuery
                  ? "Try a different search term"
                  : "Start a new conversation to get started"}
              </span>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`${styles.conversationsList} ${
        collapsed ? styles.collapsed : ""
      }`}
    >
      <div
        className={styles.conversationsScrollContainer}
        onScroll={(e) => {
          try {
            const el = e.currentTarget as HTMLDivElement;
            const distanceFromBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight;
            // if within 200px from bottom and hasMore and not already loading, trigger load more
            if (distanceFromBottom < 200 && hasMore && !isLoadingMore) {
              onLoadMore?.();
            }
          } catch {}
        }}
      >
        <List
          dataSource={conversations}
          renderItem={(conversation) => {
            const isActive = currentConversationId === conversation.id;
            const conversationContent = (
              <div
                className={`${styles.conversationItem} ${
                  isActive ? styles.active : ""
                } ${collapsed ? styles.collapsed : ""}`}
                onClick={() => onSelectConversation(conversation.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectConversation(conversation.id);
                  }
                }}
              >
                <Avatar
                  shape="square"
                  size={collapsed ? 32 : 40}
                  className={styles.avatar}
                  icon={<MessageOutlined />}
                />

                {!collapsed && (
                  <>
                    <div className={styles.conversationMeta}>
                      <div className={styles.titleRow}>
                        {/* Use CSS-based ellipsis (avoid AntD EllipsisMeasure which can trigger layout-effect loops) */}
                        <span className={styles.conversationTitle}>
                          {conversation.title || "Untitled"}
                        </span>
                        {/* Removed timestamp as requested */}
                      </div>

                      {/* Tags - show all (expected small number, e.g., up to 4). Reduce spacing/size if needed */}
                      {conversation.tags && conversation.tags.length > 0 && (
                        <div className={styles.tagsContainer}>
                          {conversation.tags.map((tag) => (
                            <Tag
                              key={tag}
                              color={getTagColor(tag)}
                              style={{
                                fontSize: "11px",
                                margin: 0,
                                padding: "2px 6px",
                              }}
                            >
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      )}

                      {/* Removed message count as requested */}
                    </div>

                    {/* three-dot menu */}
                    <div
                      className={styles.itemActions}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ConversationItemActions
                        conversation={conversation}
                        openEdit={openEdit}
                        openDelete={openDelete}
                      />
                    </div>
                  </>
                )}
              </div>
            );

            return (
              <List.Item className={styles.listItem}>
                {collapsed ? (
                  <Tooltip
                    title={conversation.title || "Untitled"}
                    placement="right"
                  >
                    {conversationContent}
                  </Tooltip>
                ) : (
                  conversationContent
                )}
              </List.Item>
            );
          }}
        />
        {/* bottom loader for infinite scroll */}
        {isLoadingMore && (
          <div className={styles.loadMoreIndicator}>
            <Spin size="small" />
          </div>
        )}
      </div>
      {/* Shared Edit Modal */}
      <ConversationForm
        open={editModal.visible}
        onCancel={handleEditCancel}
        onSubmit={handleEditSubmit}
        loading={Boolean(
          processingId && processingId === editModal.conversation?.id
        )}
        mode="edit"
        initialValues={
          editModal.conversation
            ? {
                title: editModal.conversation.title,
                model: editModal.conversation.model || "gpt-5-nano",
                context_window: editModal.conversation.context_window || 10,
                tags: editModal.conversation.tags || [],
              }
            : undefined
        }
      />

      {/* Controlled Delete Modal (replaces Modal.confirm to be compatible with AntD v5 + React 19) */}
      <Modal
        title="Delete conversation"
        open={deleteModal.visible}
        onOk={confirmDelete}
        onCancel={cancelDelete}
        okText="Delete"
        okType="danger"
        cancelText="Cancel"
        okButtonProps={{
          loading: Boolean(processingId && processingId === deleteModal.id),
        }}
      >
        <div>
          Are you sure you want to delete the conversation "{deleteModal.title}
          "? This will remove it from your list.
        </div>
      </Modal>
    </div>
  );
};

export default ConversationList;
