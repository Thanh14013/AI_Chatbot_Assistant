/**
 * MessageList Component
 * Displays list of messages with auto-scroll functionality
 */

import React, { useEffect, useRef, useState } from "react";
import { Button, Spin, Skeleton } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { Message } from "../types/chat.type";
import { PendingMessage } from "../types/offline-message.type";
import MessageBubble from "./MessageBubble";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  pendingMessages?: PendingMessage[]; // New prop for offline messages
  isLoading?: boolean;
  showScrollButton?: boolean;
  // Handler to load earlier messages (page will be managed by parent)
  onLoadEarlier?: () => Promise<void> | void;
  hasMore?: boolean;
  onRetry?: (message: Message | PendingMessage) => void;
  // For semantic search: ref to store message elements and highlighted message ID
  messageRefs?: React.MutableRefObject<Map<string, HTMLElement>>;
  highlightedMessageId?: string | null;
  // Follow-up suggestion handlers
  onRequestFollowups?: (messageId: string, content: string) => void;
  onFollowupClick?: (suggestion: string) => void;
  // Pin toggle handler
  onPinToggle?: (messageId: string, isPinned: boolean) => void;
  // Selection ask handler
  onAskAboutSelection?: (question: string, selectedText: string) => void;
  // Resend and edit handlers
  onResend?: (message: Message | PendingMessage) => void;
  onEdit?: (message: Message | PendingMessage, newContent: string) => void;
  // AI typing state to disable interactive elements
  isAITyping?: boolean;
}

/**
 * MessageList component
 * Renders messages with auto-scroll and scroll-to-bottom button
 */
const MessageList: React.FC<MessageListProps> = ({
  messages,
  pendingMessages = [],
  isLoading = false,
  showScrollButton = true,
  onLoadEarlier,
  hasMore = false,
  onRetry,
  messageRefs,
  highlightedMessageId,
  onRequestFollowups,
  onFollowupClick,
  onPinToggle,
  onAskAboutSelection,
  onResend,
  onEdit,
  isAITyping = false,
}) => {
  // Merge pending messages with real messages and sort by timestamp
  const allMessages = React.useMemo(() => {
    const pending = pendingMessages.map(
      (pm): Message => ({
        id: pm.id,
        conversation_id: pm.conversationId,
        role: pm.role || "user",
        content: pm.content,
        tokens_used: 0,
        model: "",
        createdAt: pm.createdAt,
        localStatus: pm.status as "pending" | "failed" | "sent",
      })
    );

    const combined = [...messages, ...pending];

    // Sort by timestamp
    return combined.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB;
    });
  }, [messages, pendingMessages]);
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
  // rAF refs to throttle scroll handling and wait for DOM updates
  const scrollRafRef = useRef<number | null>(null);
  const waitHeightRafRef = useRef<number | null>(null);

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
   * Robust scroll-to-bottom which retries until the container is actually
   * scrolled to the bottom (handles timing/DOM update races).
   */
  const scrollToBottomWithRetry = (
    smooth = true,
    attempt = 0,
    maxAttempts = 20
  ) => {
    // perform the immediate scroll
    scrollToBottom(smooth);

    // Quick guard: if we don't have container ref, nothing to do
    const el = containerRef.current;
    if (!el) return;

    const check = () => {
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // If close enough to bottom, we're done
      if (distanceFromBottom <= 20) return;

      // Otherwise, retry a few times (use rAF for smoother timing)
      if (attempt < maxAttempts) {
        requestAnimationFrame(() =>
          scrollToBottomWithRetry(smooth, attempt + 1, maxAttempts)
        );
      }
    };

    // Run the check on the next paint to let layout settle
    requestAnimationFrame(check);
  };

  /**
   * Handle scroll event to show/hide scroll buttons
   */
  const handleScroll = () => {
    if (!containerRef.current) return;

    // Throttle heavy work using requestAnimationFrame to avoid many setState calls
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const distanceFromTop = scrollTop;

      // Show scroll-to-bottom button if user scrolled up more than 100px from bottom
      const shouldShowScrollBtn = distanceFromBottom > 100;
      setShowScrollBtn(shouldShowScrollBtn);

      // Auto-load earlier messages when user scrolls near top
      if (distanceFromTop < 80 && hasMore && !isLoadingEarlier) {
        void handleLoadEarlier();
      }

      // Disable auto-scroll if user manually scrolled up
      if (shouldShowScrollBtn) {
        setIsAutoScrollEnabled(false);
      }
    });
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
      // Preserve scroll position: measure height and scrollTop before
      const el = containerRef.current;
      const prevScrollHeight = el.scrollHeight;
      const prevScrollTop = el.scrollTop;

      await onLoadEarlier();

      // Wait for DOM updates: poll via rAF until scrollHeight changes or timeout
      let attempts = 0;
      const maxAttempts = 60; // ~1s at 60fps

      const waitForHeightChange = () => {
        if (!containerRef.current) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const step = () => {
            attempts += 1;
            const elNow = containerRef.current;
            if (!elNow) return resolve();
            const newHeight = elNow.scrollHeight;
            if (newHeight !== prevScrollHeight || attempts >= maxAttempts) {
              // Restore scrollTop so the content the user was looking at remains visible
              elNow.scrollTop = Math.max(
                0,
                prevScrollTop + (newHeight - prevScrollHeight)
              );
              return resolve();
            }
            waitHeightRafRef.current = requestAnimationFrame(step);
          };
          step();
        });
      };

      await waitForHeightChange();
    } finally {
      setIsLoadingEarlier(false);
      if (waitHeightRafRef.current) {
        cancelAnimationFrame(waitHeightRafRef.current);
        waitHeightRafRef.current = null;
      }
    }
  };

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  useEffect(() => {
    // If messages were appended and the last message is a user or assistant message
    // (covers optimistic user sends and AI responses), force scroll to bottom.
    // Also handle streaming updates where the assistant updates the content of
    // the existing typing message (same id but content changes) â€” scroll then too.
    const prevLen = prevMessagesLengthRef.current;
    const currLen = allMessages.length;

    const last = allMessages[currLen - 1];

    if (currLen > prevLen) {
      // Detect prepend: if the last message id didn't change but length increased,
      // it's likely older messages were prepended. In that case we should NOT
      // auto-scroll to bottom (the load earlier handler already preserves scroll).
      const prevLastId = prevLastMessageRef.current.id;
      if (prevLastId && last && prevLastId === last.id) {
        // Messages were prepended; skip auto-scroll and keep current scroll position
        prevMessagesLengthRef.current = currLen;
        prevLastMessageRef.current = { id: last?.id, content: last?.content };
        return;
      }

      if (last && (last.role === "user" || last.role === "assistant")) {
        // Force scroll to bottom (smooth)
        setTimeout(() => {
          scrollToBottomWithRetry(true);
        }, 50);

        // Re-enable auto-scroll so subsequent messages also follow
        setIsAutoScrollEnabled(true);
      } else if (isAutoScrollEnabled) {
        // fallback: preserve previous behavior for other message types
        setTimeout(() => {
          scrollToBottomWithRetry(false);
        }, 100);
      }
    } else {
      // No new message appended â€” check for assistant streaming updates where
      // the last message id stays the same but content changed. In that case
      // we want to scroll to keep the user view on the streaming response.
      if (
        last &&
        last.role === "assistant" &&
        prevLastMessageRef.current.id === last.id &&
        (prevLastMessageRef.current.content || "") !== (last.content || "")
      ) {
        setTimeout(() => {
          scrollToBottomWithRetry(true);
        }, 50);
      } else if (isAutoScrollEnabled && currLen > 0) {
        // fallback: preserve previous behavior
        setTimeout(() => {
          scrollToBottomWithRetry(false);
        }, 100);
      }
    }

    prevMessagesLengthRef.current = currLen;
    prevLastMessageRef.current = {
      id: last?.id,
      content: last?.content,
    };
  }, [allMessages, isAutoScrollEnabled]);

  /**
   * Scroll to bottom on initial load (use retry to handle async DOM updates)
   */
  useEffect(() => {
    scrollToBottomWithRetry(false);
  }, []);

  // Listen for external requests to scroll to bottom (e.g. when a conversation loads)
  useEffect(() => {
    const onScrollRequest = () => scrollToBottomWithRetry(false);
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
        data-message-list="true"
        onScroll={handleScroll}
      >
        {/* Show empty placeholder when no messages */}
        {allMessages.length === 0 && !isLoading && (
          <div className={styles.emptyPlaceholder}>what's new?</div>
        )}

        {/* Show loading skeleton */}
        {isLoading && allMessages.length === 0 && renderLoadingSkeleton()}

        {/* Render messages (including pending) */}
        {allMessages.map((message) => (
          <div
            key={message.id}
            ref={(el) => {
              if (el && messageRefs) {
                messageRefs.current.set(message.id, el);
              }
            }}
            className={
              highlightedMessageId === message.id ? styles.highlighted : ""
            }
          >
            <MessageBubble
              message={message}
              onRetry={onRetry}
              onRequestFollowups={onRequestFollowups}
              onFollowupClick={onFollowupClick}
              onPinToggle={onPinToggle}
              onAskAboutSelection={onAskAboutSelection}
              onResend={onResend}
              onEdit={onEdit}
              isAITyping={isAITyping}
            />
          </div>
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
