/**
 * MessageList Component
 * Displays list of messages with auto-scroll functionality
 */

import React, { useEffect, useRef, useState } from "react";
import { Button, Spin, Skeleton } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { Message } from "../types/chat.type";
import MessageBubble from "./MessageBubble";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  showScrollButton?: boolean;
  // Handler to load earlier messages (page will be managed by parent)
  onLoadEarlier?: () => Promise<void> | void;
  hasMore?: boolean;
  onRetry?: (message: Message) => void;
}

/**
 * MessageList component
 * Renders messages with auto-scroll and scroll-to-bottom button
 */
const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading = false,
  showScrollButton = true,
  onLoadEarlier,
  hasMore = false,
  onRetry,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // load earlier button removed; rely on auto-load when scrolling near top
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const prevMessagesLengthRef = useRef<number>(messages.length);
  const prevLastMessageRef = useRef<{ id?: string; content?: string }>({
    id: undefined,
    content: undefined,
  });

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
   * Handle scroll event to show/hide scroll buttons
   */
  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const distanceFromTop = scrollTop;

    // Show scroll-to-bottom button if user scrolled up more than 100px from bottom
    const shouldShowScrollBtn = distanceFromBottom > 100;
    setShowScrollBtn(shouldShowScrollBtn);

    // Show load-earlier button if scrolled to top (within 50px) and has more messages
    // If user scrolls near top and hasMore, auto-load earlier messages

    // Auto-load earlier messages when user scrolls near top
    if (distanceFromTop < 80 && hasMore && !isLoadingEarlier) {
      // auto-load earlier messages when the user scrolls near the top
      void handleLoadEarlier();
    }

    // Disable auto-scroll if user manually scrolled up
    if (shouldShowScrollBtn) {
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
   * Handle load earlier messages
   */
  const handleLoadEarlier = async () => {
    if (!onLoadEarlier || !containerRef.current || isLoadingEarlier) return;

    setIsLoadingEarlier(true);
    try {
      // Preserve scroll position: measure height before
      const prevScrollHeight = containerRef.current.scrollHeight;
      await onLoadEarlier();

      // After parent prepends messages and DOM updates, preserve scroll position
      setTimeout(() => {
        if (!containerRef.current) return;
        const newHeight = containerRef.current.scrollHeight;
        const delta = newHeight - prevScrollHeight;
        containerRef.current.scrollTop = delta;
      }, 100);
    } finally {
      setIsLoadingEarlier(false);
    }
  };

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  useEffect(() => {
    // If messages were appended and the last message is a user or assistant message
    // (covers optimistic user sends and AI responses), force scroll to bottom.
    // Also handle streaming updates where the assistant updates the content of
    // the existing typing message (same id but content changes) — scroll then too.
    const prevLen = prevMessagesLengthRef.current;
    const currLen = messages.length;

    const last = messages[currLen - 1];

    if (currLen > prevLen) {
      if (last && (last.role === "user" || last.role === "assistant")) {
        // Force scroll to bottom (smooth)
        setTimeout(() => {
          scrollToBottom(true);
        }, 50);

        // Re-enable auto-scroll so subsequent messages also follow
        setIsAutoScrollEnabled(true);
      } else if (isAutoScrollEnabled) {
        // fallback: preserve previous behavior for other message types
        setTimeout(() => {
          scrollToBottom(false);
        }, 100);
      }
    } else {
      // No new message appended — check for assistant streaming updates where
      // the last message id stays the same but content changed. In that case
      // we want to scroll to keep the user view on the streaming response.
      if (
        last &&
        last.role === "assistant" &&
        prevLastMessageRef.current.id === last.id &&
        (prevLastMessageRef.current.content || "") !== (last.content || "")
      ) {
        setTimeout(() => {
          scrollToBottom(true);
        }, 50);
      } else if (isAutoScrollEnabled && currLen > 0) {
        // fallback: preserve previous behavior
        setTimeout(() => {
          scrollToBottom(false);
        }, 100);
      }
    }

    prevMessagesLengthRef.current = currLen;
    prevLastMessageRef.current = {
      id: last?.id,
      content: last?.content,
    };
  }, [messages, isAutoScrollEnabled]);

  /**
   * Scroll to bottom on initial load
   */
  useEffect(() => {
    scrollToBottom(false);
  }, []);

  // Listen for external requests to scroll to bottom (e.g. when a conversation loads)
  useEffect(() => {
    const onScrollRequest = () => scrollToBottom(false);
    window.addEventListener("messages:scrollToBottom", onScrollRequest);
    return () =>
      window.removeEventListener("messages:scrollToBottom", onScrollRequest);
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
      {/* Top auto-load is handled when the user scrolls near the top (no Read More button) */}

      <div
        ref={containerRef}
        className={styles.messageList}
        onScroll={handleScroll}
      >
        {/* Show loading skeleton */}
        {isLoading && messages.length === 0 && renderLoadingSkeleton()}

        {/* Render messages */}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onRetry={onRetry} />
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
      {/* Loading indicator removed per UX request (no spinner/text) */}
    </div>
  );
};

export default MessageList;
