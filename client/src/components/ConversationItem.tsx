/**
 * ConversationItem Component
 * List item for displaying individual conversations in sidebar
 */

import React from "react";
import { Typography } from "antd";
import { MessageOutlined } from "@ant-design/icons";
import { ConversationListItem } from "../types/chat.type";
import styles from "./ConversationItem.module.css";

const { Text, Paragraph } = Typography;

interface ConversationItemProps {
  conversation: ConversationListItem;
  isActive: boolean;
  onClick: (conversationId: string) => void;
}

/**
 * ConversationItem component
 * Renders a clickable conversation list item with title, preview, and timestamp
 */
const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
}) => {
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
   * Truncate long text for preview
   */
  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div
      className={`${styles.conversationItem} ${isActive ? styles.active : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Conversation icon */}
      <div className={styles.iconContainer}>
        <MessageOutlined className={styles.icon} />
      </div>

      {/* Conversation details */}
      <div className={styles.details}>
        {/* Title */}
        <Text className={styles.title} strong>
          {truncateText(conversation.title, 30)}
        </Text>

        {/* Message count and timestamp */}
        <div className={styles.metadata}>
          <Text className={styles.messageCount}>
            {conversation.message_count}{" "}
            {conversation.message_count === 1 ? "message" : "messages"}
          </Text>
          <Text className={styles.timestamp}>
            {formatTimestamp(conversation.updatedAt)}
          </Text>
        </div>
      </div>

      {/* Active indicator */}
      {isActive && <div className={styles.activeIndicator} />}
    </div>
  );
};

export default ConversationItem;
