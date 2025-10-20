/**
 * MessageBubble Component
 * Displays individual chat messages with different styles for user and assistant
 */

import React, { useState, useEffect, useRef } from "react";
import { Avatar, Typography, Button, App, Tag } from "antd";
import {
  UserOutlined,
  RobotOutlined,
  CopyOutlined,
  CheckOutlined,
  ReloadOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Message, MessageRole } from "../types/chat.type";
import { PendingMessage } from "../types/offline-message.type";
import styles from "./MessageBubble.module.css";

const { Text } = Typography;

interface MessageBubbleProps {
  message: Message | PendingMessage;
  // Optional retry handler for failed messages
  onRetry?: (message: Message | PendingMessage) => void;
  // Optional handler for requesting follow-up suggestions
  onRequestFollowups?: (messageId: string, content: string) => void;
  // Optional handler for clicking a follow-up suggestion
  onFollowupClick?: (suggestion: string) => void;
}

/**
 * MessageBubble component
 * Renders a single message with avatar, content, timestamp, and copy button
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRetry,
  onRequestFollowups,
  onFollowupClick,
}) => {
  const { message: antMessage } = App.useApp();
  const [isCopied, setIsCopied] = useState(false);
  // Client-side streaming display (progressive reveal)
  const [displayedContent, setDisplayedContent] = useState<string>(
    message.content || ""
  );
  // Render-time debug logging removed
  const lastStreamedMessageId = useRef<string | null>(null);
  const displayedContentRef = useRef<string>(displayedContent);
  // MessageRole is a string union ('user' | 'assistant' | 'system')
  // compare against the literal value
  const isUser = message.role === "user";

  // Type guard to check if message is PendingMessage
  const isPendingMessage = (
    msg: Message | PendingMessage
  ): msg is PendingMessage => {
    return "status" in msg && "retryCount" in msg;
  };

  // Local status helpers - check both Message.localStatus and PendingMessage.status
  const messageStatus = isPendingMessage(message)
    ? message.status
    : (message as Message).localStatus;

  const isFailed = messageStatus === "failed";
  const isPending = messageStatus === "pending";
  const isSending = messageStatus === "sending";

  // Follow-up suggestions state (only for Message type)
  const hasFollowups =
    !isPendingMessage(message) &&
    message.followupSuggestions &&
    message.followupSuggestions.length > 0;
  const isLoadingFollowups =
    !isPendingMessage(message) && (message.isLoadingFollowups || false);
  const isTyping = !isPendingMessage(message) && (message.isTyping || false);

  /**
   * Handle requesting follow-up suggestions
   */
  const handleRequestFollowups = () => {
    if (!isTyping && message.content && onRequestFollowups) {
      onRequestFollowups(message.id, message.content);
    }
  };

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
    // If message isTyping (stream in progress), just reflect the accumulated
    // content immediately on each chunk so the UI shows per-chunk updates.
    const full = message.content || "";

    if (isTyping) {
      try {
        // streaming chunk debug removed
      } catch {}
      setDisplayedContent(full);
      // No token timer while streaming via chunks
      return;
    }

    // Otherwise (message is finalized/not typing) run tokenized reveal
    // If there's no content, nothing to stream
    if (!full) {
      setDisplayedContent("");
      return;
    }

    // Split into tokens while preserving whitespace so spacing stays correct
    const tokens = full.match(/\s+|\S+/g) || [full];

    // Determine starting index: if we're already streaming the same message id,
    // resume from the number of tokens already displayed. Otherwise start from 0.
    let startIndex = 0;
    if (lastStreamedMessageId.current === message.id) {
      const displayedTokens =
        (displayedContentRef.current || "").match(/\s+|\S+/g) || [];
      startIndex = displayedTokens.length;
      if (startIndex >= tokens.length) {
        // Nothing new to stream
        setDisplayedContent(full);
        return;
      }
    } else {
      lastStreamedMessageId.current = message.id;
      setDisplayedContent("");
      startIndex = 0;
    }

    let idx = startIndex;
    const DELAY_MS = 40;

    // Debug logging to help trace streaming behavior in browser console
    try {
      // streaming start debug removed
    } catch {}

    const timer = setInterval(() => {
      idx += 1;
      const token = tokens[idx - 1] || "";
      setDisplayedContent((prev) => prev + token);
      try {
        // append token debug removed
      } catch {}
      if (idx >= tokens.length) {
        clearInterval(timer);
      }
    }, DELAY_MS);

    return () => {
      clearInterval(timer);
    };
  }, [message.id, message.content, message.role, isTyping]);

  // Keep a ref in sync with displayedContent so the streaming effect can
  // compute how many tokens were already shown without adding displayedContent
  // as a dependency (which would cause extra effect runs).
  useEffect(() => {
    displayedContentRef.current = displayedContent;
  }, [displayedContent]);

  return (
    <div
      className={`${styles.messageContainer} ${
        isUser ? styles.userMessage : styles.assistantMessage
      }`}
    >
      {/* Render content even while isTyping if content exists (shows streaming).
          Only show typing dots when content is empty. */}
      {!(isTyping && displayedContent.trim() === "") ? (
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
            {/* Follow-up button positioned in top-right corner for assistant messages */}
            {!isUser && !isTyping && message.content && (
              <Button
                type="text"
                size="small"
                icon={<BulbOutlined />}
                onClick={handleRequestFollowups}
                loading={isLoadingFollowups}
                className={styles.followupButtonCorner}
                title="Get follow-up suggestions"
              />
            )}

            <div className={styles.messageContent}>
              {message.role === "assistant" &&
              (!displayedContent || displayedContent.trim() === "") ? (
                <em className={styles.emptyAssistant}>
                  Assistant did not return content. Try retrying the message.
                </em>
              ) : (
                renderContent(displayedContent)
              )}
            </div>

            {/* Message footer with timestamp and actions (copy + retry) */}
            <div className={styles.messageFooter}>
              <Text className={styles.timestamp}>
                {formatTimestamp(message.createdAt)}
              </Text>

              <div className={styles.footerActions}>
                {/* Copy button (always present) */}
                <Button
                  type="text"
                  size="small"
                  icon={isCopied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={handleCopy}
                  className={styles.copyButton}
                />

                {/* Retry button shown for failed messages, placed next to copy */}
                {isFailed && (
                  <Button
                    type="link"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => onRetry && onRetry(message)}
                    className={styles.retryButton}
                  />
                )}
              </div>
            </div>

            {/* Follow-up suggestions displayed below the message with animation */}
            {!isUser && hasFollowups && (
              <div className={styles.followupSuggestionsCard}>
                <div className={styles.suggestionChips}>
                  {message.followupSuggestions!.map((suggestion, index) => (
                    <div
                      key={index}
                      className={styles.suggestionChip}
                      onClick={() =>
                        onFollowupClick && onFollowupClick(suggestion)
                      }
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading indicator for follow-up suggestions */}
            {!isUser && isLoadingFollowups && !hasFollowups && (
              <div className={styles.followupLoading}>
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
                <span className={styles.loadingText}>
                  Generating suggestions...
                </span>
              </div>
            )}
          </div>

          {/* User avatar on the right */}
          {isUser && (
            <>
              <Avatar
                icon={<UserOutlined />}
                className={`${styles.avatar} ${styles.userAvatar}`}
              />
              {/* Status indicator for pending/sending/failed messages - show next to avatar */}
              {(isPending || isSending || isFailed) && (
                <div className={styles.messageStatusBadge}>
                  {isPending && (
                    <ClockCircleOutlined style={{ color: "#8c8c8c" }} />
                  )}
                  {isSending && (
                    <SyncOutlined spin style={{ color: "#1890ff" }} />
                  )}
                  {isFailed && <WarningOutlined style={{ color: "#ff4d4f" }} />}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        // Typing placeholder: when assistant is typing and there's no accumulated
        // content yet, show the assistant avatar and a message bubble containing
        // three animated dots.
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
