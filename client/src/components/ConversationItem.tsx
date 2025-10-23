/**
 * ConversationItem Component
 * List item for displaying individual conversations in sidebar
 */

import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Dropdown, Modal, Input, App } from "antd";
import {
  MessageOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { ConversationListItem } from "../types/chat.type";
import {
  updateConversation,
  deleteConversation,
} from "../services/chat.service";
import { websocketService } from "../services/websocket.service";
import ConversationForm, { ConversationFormValues } from "./ConversationForm";
import styles from "./ConversationItem.module.css";

const { Text } = Typography;

interface ConversationItemProps {
  conversation: ConversationListItem;
  isActive: boolean;
  onClick: (conversationId: string) => void;
  onUpdate?: () => void; // Callback to refresh conversation list after rename/delete
  nested?: boolean; // Whether this item is nested inside a project
  draggable?: boolean; // Whether this item can be dragged
  onDragStart?: (conversationId: string, projectId: string | null) => void;
  onDragEnd?: () => void;
  isDragging?: boolean; // Whether this item is currently being dragged
}

/**
 * ConversationItem component
 * Renders a clickable conversation list item with title, preview, and timestamp
 */
const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
  onUpdate,
  nested = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
}) => {
  const { message } = App.useApp();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fullConversation, setFullConversation] =
    useState<ConversationListItem | null>(null);
  const navigate = useNavigate();

  /**
   * Format timestamp to relative time or date
   */
  const formatTimestamp = (timestamp: string | Date): string => {
    const date =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    // Less than 1 hour ago
    if (diffInMinutes < 60) {
      return diffInMinutes < 1 ? "Just now" : `${diffInMinutes}m ago`;
    }

    // Less than 24 hours ago
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }

    // Less than 7 days ago
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }

    // More than 7 days ago - show date
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  /**
   * Handle conversation item click
   */
  const handleClick = () => {
    onClick(conversation.id);
  };

  /**
   * Handle drag start
   */
  const handleDragStart = (e: React.DragEvent) => {
    if (draggable && onDragStart) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("conversationId", conversation.id);
      e.dataTransfer.setData("projectId", conversation.project_id || "null");
      onDragStart(conversation.id, conversation.project_id || null);
    }
  };

  /**
   * Handle drag end
   */
  const handleDragEnd = (e: React.DragEvent) => {
    if (draggable && onDragEnd) {
      onDragEnd();
    }
  };

  /**
   * Truncate long text for preview
   */
  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  /**
   * Handle edit conversation
   */
  const handleEditClick = async (e: any) => {
    e.domEvent.stopPropagation();

    // Fetch full conversation details including tags
    try {
      const { getConversation } = await import("../services/chat.service");
      const fullConv = await getConversation(conversation.id);

      setFullConversation(fullConv as any);
      setIsEditModalOpen(true);
    } catch (error) {
      message.error("Failed to load conversation details");
    }
  };

  /**
   * Handle edit form submission
   */
  const handleEditSubmit = async (values: ConversationFormValues) => {
    setIsUpdating(true);
    try {
      const result = await updateConversation(conversation.id, values);

      message.success("Conversation updated successfully");
      setIsEditModalOpen(false);

      // Trigger parent component refresh
      onUpdate?.();

      // Trigger global refresh for conversations list
      window.dispatchEvent(new Event("conversations:refresh"));

      // Dispatch conversation:updated event for THIS tab (sender is excluded from backend broadcast)
      // This ensures ProjectSection and other components reload to show updated name/tags/count
      window.dispatchEvent(
        new CustomEvent("conversation:updated", {
          detail: {
            conversationId: conversation.id,
            conversation: result,
          },
        })
      );

      // Note: Backend broadcasts conversation:updated to OTHER tabs (excludes sender socket)
    } catch (error: any) {
      message.error(
        error?.response?.data?.message || "Failed to update conversation"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Handle delete conversation with confirmation modal
   */
  const handleDelete = () => {
    // Open controlled Modal instead of Modal.confirm to avoid AntD static modal warnings
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteConversation(conversation.id);
      message.success("Conversation deleted successfully");

      // Dispatch conversation:deleted event for THIS tab (sender is excluded from backend broadcast)
      window.dispatchEvent(
        new CustomEvent("conversation:deleted", {
          detail: {
            conversationId: conversation.id,
          },
        })
      );

      // Trigger parent component refresh
      try {
        const maybe: any = onUpdate?.();
        if (maybe && typeof maybe.then === "function") {
          await maybe;
        }
      } catch {}

      // Trigger global refresh for conversations list
      window.dispatchEvent(new Event("conversations:refresh"));

      // Redirect to home after delete (replace history)
      try {
        navigate("/", { replace: true });
        setTimeout(() => {
          if (window.location.pathname !== "/") window.location.href = "/";
        }, 120);
      } catch {
        setTimeout(() => (window.location.href = "/"), 120);
      }

      // Note: Backend broadcasts conversation:deleted to OTHER tabs (excludes sender socket)
    } catch (error: any) {
      message.error(
        error?.response?.data?.message || "Failed to delete conversation"
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };

  /**
   * Dropdown menu items
   */
  const menuItems = useMemo(() => {
    return [
      {
        key: "edit",
        label: "Edit",
        icon: <EditOutlined />,
        onClick: handleEditClick,
      },
      {
        key: "delete",
        label: "Delete",
        icon: <DeleteOutlined />,
        danger: true,
        onClick: (e: any) => {
          e.domEvent.stopPropagation();
          handleDelete();
        },
      },
    ];
  }, [handleDelete]);

  return (
    <div
      className={`${styles.conversationItem} ${isActive ? styles.active : ""} ${
        nested ? styles.nested : ""
      } ${isDragging ? styles.dragging : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Small chat icon on the left */}
      <div className={styles.iconContainer}>
        <MessageOutlined className={styles.icon} />
      </div>

      {/* Conversation details */}
      <div className={styles.details}>
        {/* Title in bold */}
        <div className={styles.title}>
          {truncateText(conversation.title, 30)}
        </div>

        {/* Tags as plain text with separators */}
        {conversation.tags && conversation.tags.length > 0 && (
          <div className={styles.tags}>
            {conversation.tags.slice(0, 4).join(" • ")}
            {conversation.tags.length > 4 &&
              ` • +${conversation.tags.length - 4} more`}
          </div>
        )}
      </div>

      {/* More options dropdown */}
      <Dropdown
        menu={{ items: menuItems }}
        trigger={["click"]}
        placement="bottomRight"
      >
        <div className={styles.moreButton} onClick={(e) => e.stopPropagation()}>
          <MoreOutlined />
        </div>
      </Dropdown>

      <Modal
        title="Delete Conversation"
        open={showDeleteModal}
        onOk={confirmDelete}
        onCancel={cancelDelete}
        okText="Delete"
        okType="danger"
        cancelText="Cancel"
        centered
        okButtonProps={{ loading: isDeleting }}
      >
        <div>
          Are you sure you want to delete this conversation? This action cannot
          be undone.
        </div>
      </Modal>

      {/* Edit Conversation Modal */}
      <ConversationForm
        key={`edit-conv-${conversation.id}-${
          isEditModalOpen ? "open" : "closed"
        }`}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        loading={isUpdating}
        mode="edit"
        initialValues={{
          title: fullConversation?.title || conversation.title,
          model: fullConversation?.model || conversation.model || "gpt-5-nano",
          context_window:
            fullConversation?.context_window ||
            conversation.context_window ||
            10,
          tags: fullConversation?.tags || conversation.tags || [],
        }}
      />
    </div>
  );
};

export default ConversationItem;
