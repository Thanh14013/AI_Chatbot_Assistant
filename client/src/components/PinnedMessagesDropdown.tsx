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
      console.log(
        `[PinnedMessagesDropdown] Fetching pinned messages for conversation: ${conversationId}`
      );
      const messages = await getPinnedMessages(conversationId);
      setPinnedMessages(messages);
      console.log(
        `[PinnedMessagesDropdown] Loaded ${messages.length} pinned messages`
      );
    } catch (error) {
      console.error(
        "[PinnedMessagesDropdown] Failed to fetch pinned messages:",
        error
      );
      antMessage.error("Failed to load pinned messages");
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
      console.log(`[PinnedMessagesDropdown] Unpinning message: ${messageId}`);
      await unpinMessage(messageId);

      // Update local state
      setPinnedMessages((prev) => prev.filter((msg) => msg.id !== messageId));

      // Notify parent
      if (onMessageUnpinned) {
        onMessageUnpinned(messageId);
      }

      antMessage.success("Message unpinned");
    } catch (error) {
      console.error("[PinnedMessagesDropdown] Failed to unpin message:", error);
      antMessage.error("Failed to unpin message");
    }
  };

  /**
   * Handle clicking on a pinned message
   */
  const handleMessageClick = (messageId: string) => {
    console.log(`[PinnedMessagesDropdown] Navigating to message: ${messageId}`);
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
   */
  const menuItems: MenuProps["items"] =
    pinnedMessages.length === 0
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
      : pinnedMessages.map((msg) => ({
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
   * Fetch pinned messages on mount and when conversation changes
   */
  useEffect(() => {
    fetchPinnedMessages();
  }, [conversationId, refreshTrigger]);

  /**
   * Listen for pin/unpin events from websocket
   */
  useEffect(() => {
    const handleMessagePinned = (event: CustomEvent) => {
      const { conversationId: eventConvId, message } = event.detail;
      if (eventConvId === conversationId && message) {
        console.log(
          "[PinnedMessagesDropdown] Message pinned event received, adding to list"
        );
        setPinnedMessages((prev) => {
          // Check if already exists
          if (prev.some((msg) => msg.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    };

    const handleMessageUnpinned = (event: CustomEvent) => {
      const { conversationId: eventConvId, messageId } = event.detail;
      if (eventConvId === conversationId) {
        console.log(
          "[PinnedMessagesDropdown] Message unpinned event received, removing from list"
        );
        setPinnedMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      }
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
    >
      <Badge count={pinnedMessages.length} offset={[-5, 5]} showZero={false}>
        <Button
          type="text"
          icon={<PushpinFilled />}
          loading={loading}
          className={styles.pinnedMessagesButton}
          title={`Pinned messages (${pinnedMessages.length})`}
        >
          Pinned
        </Button>
      </Badge>
    </Dropdown>
  );
};

export default PinnedMessagesDropdown;
