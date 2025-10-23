import React, { useState, useRef, useEffect } from "react";
import { MessageOutlined } from "@ant-design/icons";
import {
  ConversationSearchResult,
  SearchMessage,
} from "../services/searchService";
import styles from "./ConversationSearchResultItem.module.css";

interface ConversationSearchResultItemProps {
  result: ConversationSearchResult;
  query: string;
  searchType?: "keyword" | "tags";
  onMessageClick: (conversationId: string, messageId: string) => void;
  tags?: string[];
}

export const ConversationSearchResultItem: React.FC<
  ConversationSearchResultItemProps
> = ({ result, query, searchType = "keyword", onMessageClick, tags }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleMessagePreviewClick = (message: SearchMessage) => {
    setIsDropdownOpen(false);
    onMessageClick(result.conversation_id, message.message_id);
  };

  const highlightKeyword = (text: string, keyword: string): React.ReactNode => {
    if (!keyword.trim()) return text;

    const regex = new RegExp(
      `(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className={styles.highlight}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className={styles.searchResultItem} ref={dropdownRef}>
      {/* Main conversation item */}
      <div className={styles.conversationItem}>
        {/* Chat icon */}
        <div className={styles.iconContainer}>
          <MessageOutlined className={styles.icon} />
        </div>

        {/* Conversation details */}
        <div className={styles.details}>
          <div className={styles.title}>
            {truncateText(result.conversation_title, 30)}
          </div>
          {/* Tags as plain text with separators */}
          {tags && tags.length > 0 && (
            <div className={styles.tags}>
              {tags.slice(0, 4).join(" • ")}
              {tags.length > 4 && ` • +${tags.length - 4} more`}
            </div>
          )}
        </div>

        {/* Badge with matched messages count - only show for keyword search */}
        {searchType === "keyword" && (
          <div
            className={styles.badge}
            onClick={handleBadgeClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleBadgeClick(e as any);
              }
            }}
          >
            {result.message_count}
          </div>
        )}
      </div>

      {/* Dropdown panel - only show for keyword search */}
      {searchType === "keyword" && isDropdownOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>Matched Messages</div>
          <div className={styles.messageList}>
            {result.top_messages.map((message, index) => (
              <div
                key={message.message_id}
                className={styles.messagePreview}
                onClick={() => handleMessagePreviewClick(message)}
              >
                <div className={styles.messageRole}>
                  {message.role === "user" ? "You" : "Assistant"}
                </div>
                <div className={styles.messageContent}>
                  {highlightKeyword(truncateText(message.content, 150), query)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
