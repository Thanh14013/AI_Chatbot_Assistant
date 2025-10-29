/**
 * MessageBubble Component
 * Displays individual chat messages with different styles for user and assistant
 */

import React, { useState, useEffect, useRef } from "react";
import { Avatar, Typography, Button, App, Input } from "antd";
import {
  UserOutlined,
  RobotOutlined,
  CopyOutlined,
  CheckOutlined,
  ReloadOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  PushpinOutlined,
  PushpinFilled,
  RedoOutlined,
} from "@ant-design/icons";
import { Message } from "../types/chat.type";
import { PendingMessage } from "../types/offline-message.type";
import styles from "./MessageBubble.module.css";
import { pinMessage, unpinMessage } from "../services/chat.service";
import SelectionAskButton from "./SelectionAskButton";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface MessageBubbleProps {
  message: Message | PendingMessage;
  // Optional retry handler for failed messages
  onRetry?: (message: Message | PendingMessage) => void;
  // Optional handler for requesting follow-up suggestions
  onRequestFollowups?: (messageId: string, content: string) => void;
  // Optional handler for clicking a follow-up suggestion
  onFollowupClick?: (suggestion: string) => void;
  // Optional handler for when a message is pinned/unpinned
  onPinToggle?: (messageId: string, isPinned: boolean) => void;
  // Optional handler for asking about selected text
  onAskAboutSelection?: (selectedText: string) => void;
  // Optional handler for resending a user message
  onResend?: (message: Message | PendingMessage) => void;
  // Optional handler for editing and resending a user message
  onEdit?: (message: Message | PendingMessage, newContent: string) => void;
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
  onPinToggle,
  onAskAboutSelection,
  onResend,
  onEdit,
}) => {
  const { message: antMessage } = App.useApp();
  const [isCopied, setIsCopied] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const editTextAreaRef = useRef<any>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleWidth, setBubbleWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Client-side streaming display (progressive reveal)
  const [displayedContent, setDisplayedContent] = useState<string>(
    message.content || ""
  );
  // Render-time debug logging removed
  const lastStreamedMessageId = useRef<string | null>(null);
  const displayedContentRef = useRef<string>(displayedContent);
  // Reference to message content container for selection detection
  const messageContentRef = useRef<HTMLDivElement>(null);
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

  // Retry metadata
  const retryCount = !isPendingMessage(message)
    ? (message as Message).retryCount || 0
    : 0;
  const errorMessage = !isPendingMessage(message)
    ? (message as Message).errorMessage
    : undefined;
  const maxRetries = 3;

  // Follow-up suggestions state (only for Message type)
  const hasFollowups =
    !isPendingMessage(message) &&
    message.followupSuggestions &&
    message.followupSuggestions.length > 0;
  const isLoadingFollowups =
    !isPendingMessage(message) && (message.isLoadingFollowups || false);
  const isTyping = !isPendingMessage(message) && (message.isTyping || false);

  // Pin status (only for Message type)
  const isPinned = !isPendingMessage(message) && (message.pinned || false);

  /**
   * Handle pin/unpin toggle
   */
  const handlePinToggle = async () => {
    if (isPendingMessage(message) || isPinning) return;

    // Don't allow pinning temporary/typing messages
    if (message.id.startsWith("temp_") || message.isTyping) {
      return;
    }

    // IMPORTANT: Read current pinned status directly from message prop
    // to avoid using stale cached const value
    const currentPinned =
      !isPendingMessage(message) && (message.pinned || false);

    setIsPinning(true);
    try {
      if (currentPinned) {
        await unpinMessage(message.id);

        // Dispatch custom event to update other components
        window.dispatchEvent(
          new CustomEvent("message:unpinned", {
            detail: {
              conversationId: message.conversation_id,
              messageId: message.id,
            },
          })
        );

        antMessage.success("Message unpinned");
      } else {
        await pinMessage(message.id);

        // Dispatch custom event to update other components
        window.dispatchEvent(
          new CustomEvent("message:pinned", {
            detail: {
              conversationId: message.conversation_id,
              messageId: message.id,
              message: message,
            },
          })
        );

        antMessage.success("Message pinned");
      }

      // Notify parent component
      if (onPinToggle) {
        onPinToggle(message.id, !currentPinned);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        antMessage.error(
          error.message ||
            `Failed to ${currentPinned ? "unpin" : "pin"} message`
        );
      } else {
        antMessage.error(
          `Failed to ${currentPinned ? "unpin" : "pin"} message`
        );
      }
    } finally {
      setIsPinning(false);
    }
  };

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
   * Handle resend button click
   */
  const handleResend = () => {
    if (onResend && isUser) {
      onResend(message);
    }
  };

  /**
   * Handle message content click to enable editing
   */
  const handleMessageClick = () => {
    if (isUser && !isEditing && !isFailed && !isPending && !isSending) {
      // Capture current bubble width before entering edit mode
      if (bubbleRef.current) {
        const currentWidth = bubbleRef.current.offsetWidth;
        setBubbleWidth(currentWidth);
      }
      setIsEditing(true);
      setEditContent(message.content);
      // Focus textarea after state update
      setTimeout(() => {
        editTextAreaRef.current?.focus();
      }, 50);
    }
  };

  /**
   * Handle edit submit (Enter key)
   */
  const handleEditSubmit = () => {
    const trimmedContent = editContent.trim();
    if (trimmedContent && onEdit && trimmedContent !== message.content) {
      onEdit(message, trimmedContent);
    }
    setIsEditing(false);
    setEditContent("");
    setBubbleWidth(null);
  };

  /**
   * Handle edit cancel (Escape key)
   */
  const handleEditCancel = () => {
    setIsEditing(false);
    setEditContent("");
    setBubbleWidth(null);
  };

  /**
   * Handle edit textarea key down
   */
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleEditCancel();
    }
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
    } catch {
      // Copy failed - silently ignore
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
      } catch {
        // Ignore debug logging errors
      }
      setDisplayedContent(full);
      lastStreamedMessageId.current = message.id;
      // No token timer while streaming via chunks
      return;
    }

    // Otherwise (message is finalized/not typing) run tokenized reveal
    // If there's no content, nothing to stream
    if (!full) {
      setDisplayedContent("");
      return;
    }

    // If this message was just streamed (lastStreamedMessageId matches and isTyping just turned false),
    // skip the tokenized reveal and just show full content immediately
    if (
      lastStreamedMessageId.current === message.id &&
      displayedContentRef.current === full
    ) {
      // Already fully displayed during streaming, no need to re-animate
      setDisplayedContent(full);
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
    } catch {
      // Ignore debug logging errors
    }

    const timer = setInterval(() => {
      idx += 1;
      const token = tokens[idx - 1] || "";
      setDisplayedContent((prev) => prev + token);
      try {
        // append token debug removed
      } catch {
        // Ignore debug logging errors
      }
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

  // Handle clicking outside to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isEditing &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleEditCancel();
      }
    };

    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isEditing]);

  return (
    <div
      ref={containerRef}
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
          <div
            ref={bubbleRef}
            className={`${styles.messageBubble} ${
              isPinned ? styles.pinnedMessage : ""
            } ${isUser ? styles.userBubble : ""} ${
              isEditing ? styles.editingMode : ""
            }`}
          >
            {/* Pin button positioned in top-right corner */}
            {!isPendingMessage(message) &&
              message.content &&
              !message.id.startsWith("temp_") &&
              !message.isTyping && (
                <Button
                  type="text"
                  size="small"
                  icon={isPinned ? <PushpinFilled /> : <PushpinOutlined />}
                  onClick={handlePinToggle}
                  loading={isPinning}
                  className={`${styles.pinButtonCorner} ${
                    isPinned ? styles.pinned : ""
                  }`}
                  title={isPinned ? "Unpin message" : "Pin message"}
                />
              )}

            {/* Message content - clickable for user messages to edit */}
            {isEditing ? (
              <TextArea
                ref={editTextAreaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                autoSize={{ minRows: 1, maxRows: 6 }}
                className={styles.editTextArea}
                placeholder="Edit your message..."
                style={bubbleWidth ? { width: bubbleWidth - 28 } : undefined}
              />
            ) : (
              <div
                className={`${styles.messageContent} ${
                  isUser ? styles.clickableContent : ""
                }`}
                ref={messageContentRef}
                onClick={handleMessageClick}
              >
                {message.role === "assistant" &&
                (!displayedContent || displayedContent.trim() === "") ? (
                  <em className={styles.emptyAssistant}>
                    Assistant did not return content. Try retrying the message.
                  </em>
                ) : (
                  renderContent(displayedContent)
                )}
              </div>
            )}

            {/* Attachments display - show files attached to message */}
            {!isPendingMessage(message) &&
              message.attachments &&
              message.attachments.length > 0 && (
                <div className={styles.attachmentsContainer}>
                  {message.attachments.map((attachment, index) => (
                    <div key={index} className={styles.attachmentItem}>
                      {attachment.resource_type === "image" ? (
                        // Image preview
                        <a
                          href={attachment.secure_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.imageAttachment}
                        >
                          <img
                            src={
                              attachment.thumbnail_url || attachment.secure_url
                            }
                            alt={attachment.original_filename || "Image"}
                            className={styles.attachmentImage}
                          />
                        </a>
                      ) : (
                        // File link for non-image files
                        <a
                          href={attachment.secure_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.fileAttachment}
                        >
                          <div className={styles.fileIcon}>📄</div>
                          <div className={styles.fileInfo}>
                            <div className={styles.fileName}>
                              {attachment.original_filename || "File"}
                            </div>
                            <div className={styles.fileSize}>
                              {attachment.format?.toUpperCase() || "FILE"}
                              {attachment.size_bytes &&
                                ` • ${(attachment.size_bytes / 1024).toFixed(
                                  1
                                )} KB`}
                            </div>
                          </div>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

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
                  disabled={isSending}
                />

                {/* Resend button for user messages - show on hover like copy button */}
                {isUser && onResend && !isEditing && (
                  <Button
                    type="text"
                    size="small"
                    icon={<RedoOutlined />}
                    onClick={handleResend}
                    className={styles.resendButton}
                    disabled={isSending || isPending}
                    title="Resend this message"
                  />
                )}

                {/* Retry button shown for failed messages, placed next to copy */}
                {isFailed && (
                  <Button
                    type="link"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => onRetry && onRetry(message)}
                    className={styles.retryButton}
                    disabled={isSending || retryCount >= maxRetries}
                    title={
                      retryCount >= maxRetries
                        ? `Maximum retry attempts (${maxRetries}) reached`
                        : `Retry (${retryCount}/${maxRetries} attempts)`
                    }
                  />
                )}
              </div>
            </div>

            {/* Error message display for failed messages */}
            {isFailed && errorMessage && (
              <div className={styles.errorMessageContainer}>
                <WarningOutlined className={styles.errorIcon} />
                <Text className={styles.errorText}>
                  {errorMessage}
                  {retryCount > 0 && ` (Attempt ${retryCount}/${maxRetries})`}
                </Text>
              </div>
            )}

            {/* Sending status display */}
            {isSending && (
              <div className={styles.sendingStatusContainer}>
                <SyncOutlined spin className={styles.sendingIcon} />
                <Text className={styles.sendingText}>
                  {retryCount > 0
                    ? `Retrying (${retryCount}/${maxRetries})...`
                    : "Sending..."}
                </Text>
              </div>
            )}

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

      {/* Selection Ask Button - only for AI messages */}
      {!isUser && onAskAboutSelection && (
        <SelectionAskButton
          containerRef={messageContentRef}
          onAskAboutSelection={onAskAboutSelection}
          isAIMessage={!isUser}
          messageId={message.id}
          contentKey={message.content?.length || 0}
        />
      )}
    </div>
  );
};

export default MessageBubble;
