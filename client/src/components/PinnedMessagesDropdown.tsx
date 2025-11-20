/**
 * PinnedMessagesDropdown Component
 * Displays a dropdown list of pinned messages in the conversation header
 */

import React, { useState, useEffect } from "react";
import { Button, Dropdown, Badge, Space, Empty, App } from "antd";
import type { MenuProps } from "antd";
import { PushpinFilled, CloseOutlined } from "@ant-design/icons";
import { Message } from "../types/chat.type";
import { getPinnedMessages, unpinMessage } from "../services/chat.service";
import styles from "./PinnedMessagesDropdown.module.css";

interface PinnedMessagesDropdownProps {
  conversationId: string;
  // Callback when a pinned message is clicked
  onMessageClick?: (messageId: string) => void;
  // Callback when a message is unpinned
  onMessageUnpinned?: (messageId: string) => void;
  // External trigger to refresh the list
  refreshTrigger?: number;
  // 🚀 OPTIMISTIC UI: Client-side pinned message IDs for instant sync
  pinnedMessageIds?: Set<string>;
}

/**
 * PinnedMessagesDropdown component
 * Shows a dropdown with pinned messages for the current conversation
 */
const PinnedMessagesDropdown: React.FC<PinnedMessagesDropdownProps> = ({
  conversationId,
  onMessageClick,
  onMessageUnpinned,
  refreshTrigger = 0,
  pinnedMessageIds,
}) => {
  const { message: antMessage } = App.useApp();
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  /**
   * Fetch pinned messages for the conversation
   */
  const fetchPinnedMessages = async () => {
    if (!conversationId) return;

    setLoading(true);
    try {
      const messages = await getPinnedMessages(conversationId);
      setPinnedMessages(messages);
    } catch (error: any) {
      // Don't show error toast if conversation was deleted (403/404)
      const status = error?.response?.status;
      if (status !== 403 && status !== 404) {
        antMessage.error("Failed to load pinned messages");
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle unpinning a message
   */
  const handleUnpin = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing

    try {
      await unpinMessage(messageId);

      // Update local state
      setPinnedMessages((prev) => prev.filter((msg) => msg.id !== messageId));

      // Dispatch custom event to update message list
      window.dispatchEvent(
        new CustomEvent("message:unpinned", {
          detail: {
            conversationId,
            messageId,
          },
        })
      );

      // Notify parent
      if (onMessageUnpinned) {
        onMessageUnpinned(messageId);
      }

      antMessage.success("Message unpinned");
    } catch (error) {
      antMessage.error("Failed to unpin message");
    }
  };

  /**
   * Handle clicking on a pinned message
   */
  const handleMessageClick = (messageId: string) => {
    setDropdownOpen(false);
    if (onMessageClick) {
      onMessageClick(messageId);
    }
  };

  /**
   * Truncate message content for display
   */
  const truncateContent = (content: string, maxLength: number = 60): string => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp: string | Date): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  /**
   * Build dropdown menu items
   * 🚀 OPTIMISTIC UI: Use pinnedMessageIds if provided for instant sync
   */
  const displayMessages = pinnedMessageIds
    ? pinnedMessages.filter((msg) => pinnedMessageIds.has(msg.id))
    : pinnedMessages;

  const menuItems: MenuProps["items"] =
    displayMessages.length === 0
      ? [
          {
            key: "empty",
            label: (
              <div className={styles.emptyState}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No pinned messages"
                />
              </div>
            ),
            disabled: true,
          },
        ]
      : displayMessages.map((msg) => ({
          key: msg.id,
          label: (
            <div
              className={styles.pinnedMessageItem}
              onClick={() => handleMessageClick(msg.id)}
            >
              <div className={styles.messageHeader}>
                <span className={styles.messageRole}>
                  {msg.role === "user" ? "You" : "Assistant"}
                </span>
                <span className={styles.messageTime}>
                  {formatTimestamp(msg.createdAt)}
                </span>
              </div>
              <div className={styles.messageContent}>
                {truncateContent(msg.content)}
              </div>
              <Button
                type="text"
                size="small"
                danger
                icon={<CloseOutlined />}
                className={styles.unpinButton}
                onClick={(e) => handleUnpin(msg.id, e)}
                title="Unpin message"
              />
            </div>
          ),
        }));

  /**
   * Fetch pinned messages only when conversation changes (not on refreshTrigger)
   * Event listeners handle real-time updates for instant UX
   */
  useEffect(() => {
    fetchPinnedMessages();
  }, [conversationId]);

  /**
   * Listen for pin/unpin events from websocket AND client-side optimistic updates
   */
  useEffect(() => {
    const handleMessagePinned = (event: Event) => {
      const {
        conversationId: eventConvId,
        message,
        messageId,
      } = (event as CustomEvent).detail;

      if (eventConvId !== conversationId) return;

      // Optimistic update: add immediately even if we don't have full message
      setPinnedMessages((prev) => {
        // Check if already exists
        if (prev.some((msg) => msg.id === (message?.id || messageId)))
          return prev;

        // If we have the full message, add it
        if (message) {
          return [...prev, message];
        }
        // Otherwise, we'll fetch it from the server on next refresh
        return prev;
      });
    };

    const handleMessageUnpinned = (event: Event) => {
      const { conversationId: eventConvId, messageId } = (event as CustomEvent)
        .detail;

      if (eventConvId !== conversationId) return;

      // Optimistic update: remove immediately
      setPinnedMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    };

    window.addEventListener(
      "message:pinned",
      handleMessagePinned as EventListener
    );
    window.addEventListener(
      "message:unpinned",
      handleMessageUnpinned as EventListener
    );

    return () => {
      window.removeEventListener(
        "message:pinned",
        handleMessagePinned as EventListener
      );
      window.removeEventListener(
        "message:unpinned",
        handleMessageUnpinned as EventListener
      );
    };
  }, [conversationId]);

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={["click"]}
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      placement="bottomRight"
      overlayClassName={styles.pinnedMessagesDropdown}
      getPopupContainer={() => document.body}
    >
      <Badge count={displayMessages.length} offset={[-5, 5]} showZero={false}>
        <Button
          type="text"
          icon={<PushpinFilled />}
          loading={loading}
          className={styles.pinnedMessagesButton}
          title={`Pinned messages (${displayMessages.length})`}
        >
          Pinned
        </Button>
      </Badge>
    </Dropdown>
  );
};

export default PinnedMessagesDropdown;
