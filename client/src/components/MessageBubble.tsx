/**
 * MessageBubble Component
 * Displays individual chat messages with different styles for user and assistant
 */

import React, { useState, useEffect, useRef } from "react";
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
  // Optional retry handler for failed messages
  onRetry?: (message: Message) => void;
}

/**
 * MessageBubble component
 * Renders a single message with avatar, content, timestamp, and copy button
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onRetry }) => {
  const [isCopied, setIsCopied] = useState(false);
  // Client-side streaming display (progressive reveal)
  const [displayedContent, setDisplayedContent] = useState<string>(
    message.content || ""
  );
  const lastStreamedMessageId = useRef<string | null>(null);
  // MessageRole is a string union ('user' | 'assistant' | 'system')
  // compare against the literal value
  const isUser = message.role === "user";

  // Local status helpers
  const isFailed = message.localStatus === "failed";
  const isPending = message.localStatus === "pending";

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

  // Client-side streaming: reveal assistant message token-by-token
  useEffect(() => {
    // Only stream assistant messages that are not typing
    if (message.role !== "assistant" || message.isTyping) {
      setDisplayedContent(message.content || "");
      return;
    }

    const full = message.content || "";

    // If there's no content, nothing to stream
    if (!full) {
      setDisplayedContent("");
      return;
    }

    // Avoid re-streaming the same message repeatedly
    if (lastStreamedMessageId.current === message.id) {
      setDisplayedContent(full);
      return;
    }

    lastStreamedMessageId.current = message.id;
    setDisplayedContent("");

    // Split into tokens while preserving whitespace so spacing stays correct
    const tokens = full.match(/\s+|\S+/g) || [full];
    let idx = 0;

    // Delay per token (ms). Adjust for speed: lower -> faster.
    const DELAY_MS = 40;

    const timer = setInterval(() => {
      idx += 1;
      setDisplayedContent((prev) => prev + (tokens[idx - 1] || ""));
      if (idx >= tokens.length) {
        clearInterval(timer);
      }
    }, DELAY_MS);

    return () => {
      clearInterval(timer);
    };
  }, [message.id, message.content, message.role, message.isTyping]);

  return (
    <div
      className={`${styles.messageContainer} ${
        isUser ? styles.userMessage : styles.assistantMessage
      }`}
    >
      {!message.isTyping ? (
        <>
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
              {message.role === "assistant" &&
              (!message.content || message.content.trim() === "") ? (
                <em className={styles.emptyAssistant}>
                  Assistant did not return content. Try retrying the message.
                </em>
              ) : (
                renderContent(message.content)
              )}
            </div>

            {/* Message footer with timestamp and copy button */}
            <div className={styles.messageFooter}>
              <Text className={styles.timestamp}>
                {formatTimestamp(message.createdAt)}
              </Text>

              {/* Show retry button if failed */}
              {isFailed ? (
                <Button
                  type="link"
                  onClick={() => onRetry && onRetry(message)}
                  className={styles.retryButton}
                >
                  Retry
                </Button>
              ) : (
                <Button
                  type="text"
                  size="small"
                  icon={isCopied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={handleCopy}
                  className={styles.copyButton}
                />
              )}
            </div>
          </div>

          {/* User avatar on the right */}
          {isUser && (
            <Avatar
              icon={<UserOutlined />}
              className={`${styles.avatar} ${styles.userAvatar}`}
            />
          )}
        </>
      ) : (
        // Typing placeholder (assistant)
        <div className={styles.typingRow}>
          <Avatar
            icon={<RobotOutlined />}
            className={`${styles.avatar} ${styles.assistantAvatar}`}
          />
          <div className={styles.messageBubble}>
            <div className={styles.typingPlaceholder}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
