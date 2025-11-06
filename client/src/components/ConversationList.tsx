/**
 * ConversationList Component - Simplified to use unified ConversationItem
 */

import React from "react";
import { Spin, Button, Empty } from "antd";
import {
  MessageOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import ConversationItem from "./ConversationItem";
import type { ConversationListItem } from "../types/chat.type";
import styles from "./ConversationList.module.css";

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
  // Drag & Drop
  onDragOver?: () => void;
  onDrop?: (conversationId: string, sourceProjectId: string | null) => void;
  onDragLeave?: () => void;
  isDropTarget?: boolean;
  draggedConversationId?: string | null;
  onConversationDragStart?: (
    conversationId: string,
    projectId: string | null
  ) => void;
  onConversationDragEnd?: () => void;
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
  onDragOver,
  onDrop,
  onDragLeave,
  isDropTarget = false,
  draggedConversationId = null,
  onConversationDragStart,
  onConversationDragEnd,
}) => {
  // Define drag handlers first (before early returns)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Call parent callback - parent (Sidebar) has the drag state
    // Cannot read dataTransfer.getData() during dragover due to browser security
    if (onDragOver) {
      onDragOver();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const conversationId = e.dataTransfer.getData("conversationId");
    const sourceProjectId = e.dataTransfer.getData("projectId");

    // Convert "null" string to actual null
    const actualSourceProjectId =
      !sourceProjectId || sourceProjectId === "null" ? null : sourceProjectId;

    // Only process drop if conversation is from a project
    if (onDrop && conversationId && actualSourceProjectId) {
      onDrop(conversationId, actualSourceProjectId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      e.currentTarget === e.target ||
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      if (onDragLeave) {
        onDragLeave();
      }
    }
  };

  // Early returns with drag support
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
    // Show empty state with drop zone support
    return (
      <div
        className={`${styles.emptyState} ${
          isDropTarget ? styles.dropZoneActive : ""
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragLeave}
      >
        {isDropTarget ? (
          <div className={styles.emptyDropZone}>
            <MessageOutlined className={styles.dropZoneIcon} />
            <div className={styles.dropZoneText}>
              Drop here to move to All Conversations
            </div>
          </div>
        ) : (
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
        )}
      </div>
    );
  }

  // Main return with conversations list
  return (
    <div
      className={`${styles.conversationsList} ${
        collapsed ? styles.collapsed : ""
      } ${isDropTarget ? styles.dropZoneActive : ""}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      <div
        className={styles.conversationsScrollContainer}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onScroll={(e) => {
          try {
            const el = e.currentTarget as HTMLDivElement;
            const distanceFromBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight;
            if (distanceFromBottom < 200 && hasMore && !isLoadingMore) {
              onLoadMore?.();
            }
          } catch {}
        }}
      >
        {/* Use unified ConversationItem component - same as Projects section */}
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isActive={currentConversationId === conversation.id}
            onClick={onSelectConversation}
            onUpdate={onRefresh}
            nested={false}
            draggable={true}
            isDragging={conversation.id === draggedConversationId}
            onDragStart={onConversationDragStart}
            onDragEnd={onConversationDragEnd}
          />
        ))}

        {/* Show drop zone hint when dragging and list is small */}
        {isDropTarget && conversations.length < 3 && (
          <div className={styles.dropZoneHint}>
            Drop here to move to All Conversations
          </div>
        )}

        {/* Infinite scroll loader */}
        {isLoadingMore && (
          <div className={styles.loadMoreIndicator}>
            <Spin size="small" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
