/**
 * MessageList Component
 * Displays list of messages with auto-scroll functionality
 */

import React, { useEffect, useRef, useState } from "react";
import { Button, Spin, Skeleton } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { Message } from "../types/chat.type";
import MessageBubble from "./MessageBubble";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  showScrollButton?: boolean;
}

/**
 * MessageList component
 * Renders messages with auto-scroll and scroll-to-bottom button
 */
const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading = false,
  showScrollButton = true,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  /**
   * Scroll to bottom of message list
   */
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
  };

  /**
   * Handle scroll event to show/hide scroll button
   */
  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Show scroll button if user scrolled up more than 100px from bottom
    const shouldShowButton = distanceFromBottom > 100;
    setShowScrollBtn(shouldShowButton);

    // Disable auto-scroll if user manually scrolled up
    if (shouldShowButton) {
      setIsAutoScrollEnabled(false);
    }
  };

  /**
   * Handle scroll to bottom button click
   */
  const handleScrollButtonClick = () => {
    scrollToBottom(true);
    setIsAutoScrollEnabled(true);
  };

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  useEffect(() => {
    if (isAutoScrollEnabled && messages.length > 0) {
      // Use timeout to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom(false);
      }, 100);
    }
  }, [messages, isAutoScrollEnabled]);

  /**
   * Scroll to bottom on initial load
   */
  useEffect(() => {
    scrollToBottom(false);
  }, []);

  /**
   * Render loading skeleton
   */
  const renderLoadingSkeleton = () => {
    return (
      <div className={styles.loadingContainer}>
        {[1, 2, 3].map((index) => (
          <div key={index} className={styles.skeletonItem}>
            <Skeleton avatar active paragraph={{ rows: 2 }} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.messageListContainer}>
      <div
        ref={containerRef}
        className={styles.messageList}
        onScroll={handleScroll}
      >
        {/* Show loading skeleton */}
        {isLoading && messages.length === 0 && renderLoadingSkeleton()}

        {/* Render messages */}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Invisible div to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && showScrollBtn && (
        <Button
          type="primary"
          shape="circle"
          icon={<DownOutlined />}
          className={styles.scrollButton}
          onClick={handleScrollButtonClick}
          size="large"
        />
      )}

      {/* Loading indicator at bottom when sending message */}
      {isLoading && messages.length > 0 && (
        <div className={styles.loadingIndicator}>
          <Spin size="small" />
          <span className={styles.loadingText}>AI is typing...</span>
        </div>
      )}
    </div>
  );
};

export default MessageList;
