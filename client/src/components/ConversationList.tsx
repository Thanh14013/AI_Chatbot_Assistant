import React from "react";
import {
  List,
  Avatar,
  Typography,
  Spin,
  Button,
  Empty,
  Dropdown,
  Menu,
  Modal,
  Input,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  MessageOutlined,
  LoadingOutlined,
  ReloadOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import {
  updateConversation,
  deleteConversation,
} from "../services/chat.service";
import type { ConversationListItem } from "../types/chat.type";
import styles from "./ConversationList.module.css";

const { Text } = Typography;

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
}) => {
  const navigate = useNavigate();
  // State for rename modal (single shared modal)
  const [renameModal, setRenameModal] = React.useState<{
    visible: boolean;
    id: string | null;
    value: string;
  }>({ visible: false, id: null, value: "" });

  // State for delete confirmation modal (controlled, avoid Modal.confirm static API)
  const [deleteModal, setDeleteModal] = React.useState<{
    visible: boolean;
    id: string | null;
    title: string;
  }>({ visible: false, id: null, title: "" });

  // Track which conversation is currently processing an action (rename/delete)
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const openRename = (
    conversation: ConversationListItem,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setRenameModal({
      visible: true,
      id: conversation.id,
      value: conversation.title || "",
    });
  };

  const handleRenameOk = async () => {
    const id = renameModal.id;
    const trimmed = (renameModal.value || "").trim();
    if (!id) return;
    if (!trimmed) {
      message.error("Title cannot be empty");
      return;
    }

    setProcessingId(id);
    try {
      await updateConversation(id, { title: trimmed });
      setRenameModal({ visible: false, id: null, value: "" });
      onRefresh();
      message.success("Conversation renamed");
    } catch (err) {
      message.error("Failed to rename conversation");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRenameCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenameModal({ visible: false, id: null, value: "" });
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
      // Refresh conversations list (await if it returns a Promise)
      try {
        const maybe: any = onRefresh?.();
        if (maybe && typeof maybe.then === "function") {
          await maybe;
        }
      } catch {}

      // Redirect to home after deletion (replace history so back doesn't return)
      try {
        console.debug("Deleting convo successful, navigating to /");
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
        <Text type="danger">{error}</Text>
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
              <Text className={styles.emptyText}>
                {searchQuery
                  ? "No conversations found"
                  : "No conversations yet"}
              </Text>
              <br />
              <Text className={styles.emptySubtext}>
                {searchQuery
                  ? "Try a different search term"
                  : "Start a new conversation to get started"}
              </Text>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.conversationsList}>
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
            return (
              <List.Item className={styles.listItem}>
                <div
                  className={`${styles.conversationItem} ${
                    isActive ? styles.active : ""
                  }`}
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
                    size={40}
                    className={styles.avatar}
                    icon={<MessageOutlined />}
                  />

                  <div className={styles.conversationMeta}>
                    <div className={styles.titleRow}>
                      <Text className={styles.conversationTitle} ellipsis>
                        {conversation.title || "Untitled"}
                      </Text>
                      <Text className={styles.timeText}>
                        {formatTime(conversation.updatedAt)}
                      </Text>
                    </div>
                    {/* Removed message count as requested */}
                  </div>

                  {/* three-dot menu */}
                  <div
                    className={styles.itemActions}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: [
                          {
                            key: "rename",
                            label: "Rename",
                            onClick: () => openRename(conversation),
                          },
                          {
                            key: "delete",
                            label: "Delete",
                            onClick: () => openDelete(conversation),
                            danger: true,
                          },
                        ],
                      }}
                      placement="bottomRight"
                    >
                      <Button type="text" icon={<MoreOutlined />} />
                    </Dropdown>
                  </div>
                </div>
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
      {/* Shared Rename Modal */}
      <Modal
        title="Rename conversation"
        open={renameModal.visible}
        onOk={handleRenameOk}
        onCancel={handleRenameCancel}
        okButtonProps={{
          loading: Boolean(processingId && processingId === renameModal.id),
        }}
      >
        <Input
          value={renameModal.value}
          onChange={(e) =>
            setRenameModal((s) => ({ ...s, value: e.target.value }))
          }
          onPressEnter={handleRenameOk}
          placeholder="Conversation title"
        />
      </Modal>

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
