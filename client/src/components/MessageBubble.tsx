/**
 * MessageBubble Component
 * Displays individual chat messages with different styles for user and assistant
 */

import React, { useState } from "react";
import { Avatar, Typography, Button, message as antMessage } from "antd";
import {
  UserOutlined,
  RobotOutlined,
  CopyOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { Message, MessageRole } from "../types/chat.type";
import styles from "./MessageBubble.module.css";

const { Text } = Typography;

interface MessageBubbleProps {
  message: Message;
}

/**
 * MessageBubble component
 * Renders a single message with avatar, content, timestamp, and copy button
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [isCopied, setIsCopied] = useState(false);
  // MessageRole is a string union ('user' | 'assistant' | 'system')
  // compare against the literal value
  const isUser = message.role === "user";

  /**
   * Format timestamp to readable format
   */
  const formatTimestamp = (timestamp: string | Date): string => {
    const date =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    // If message is from today, show time only
    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // If message is older, show date and time
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /**
   * Copy message content to clipboard
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      antMessage.success("Message copied to clipboard");

      // Reset copy button state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy message:", error);
      antMessage.error("Failed to copy message");
    }
  };

  /**
   * Render message content with basic markdown support
   * For now, just render as text. Full markdown rendering can be added later
   */
  const renderContent = (content: string) => {
    // Split content by code blocks (simple detection)
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      // Check if this is a code block
      if (part.startsWith("```") && part.endsWith("```")) {
        const code = part.slice(3, -3).trim();
        return (
          <pre key={index} className={styles.codeBlock}>
            <code>{code}</code>
          </pre>
        );
      }

      // Regular text with line breaks preserved
      return (
        <span key={index} className={styles.textContent}>
          {part}
        </span>
      );
    });
  };

  return (
    <div
      className={`${styles.messageContainer} ${
        isUser ? styles.userMessage : styles.assistantMessage
      }`}
    >
      {/* Avatar - show on left for assistant, right for user */}
      {!isUser && (
        <Avatar
          icon={<RobotOutlined />}
          className={`${styles.avatar} ${styles.assistantAvatar}`}
        />
      )}

      {/* Message content bubble */}
      <div className={styles.messageBubble}>
        <div className={styles.messageContent}>
          {renderContent(message.content)}
        </div>

        {/* Message footer with timestamp and copy button */}
        <div className={styles.messageFooter}>
          <Text className={styles.timestamp}>
            {formatTimestamp(message.createdAt)}
          </Text>

          {/* Copy button */}
          <Button
            type="text"
            size="small"
            icon={isCopied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopy}
            className={styles.copyButton}
          />
        </div>
      </div>

      {/* User avatar on the right */}
      {isUser && (
        <Avatar
          icon={<UserOutlined />}
          className={`${styles.avatar} ${styles.userAvatar}`}
        />
      )}
    </div>
  );
};

export default MessageBubble;
