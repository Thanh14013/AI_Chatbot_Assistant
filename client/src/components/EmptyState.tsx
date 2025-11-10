/**
 * EmptyState Component
 * Displays empty states for conversations and messages
 */

import React from "react";
import { Empty, Button } from "antd";
import {
  InboxOutlined,
  MessageOutlined,
  PlusOutlined,
  BulbOutlined,
} from "@ant-design/icons";
import styles from "./EmptyState.module.css";

// Use native elements instead of AntD Typography to avoid EllipsisMeasure

interface EmptyStateProps {
  type: "conversations" | "messages";
  onAction?: () => void;
  actionText?: string;
}

/**
 * EmptyState component
 * Renders different empty states based on type
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  onAction,
  actionText,
}) => {
  /**
   * Render empty conversations list state
   */
  const renderEmptyConversations = () => {
    return (
      <div className={styles.emptyContainer}>
        <Empty
          image={<InboxOutlined className={styles.emptyIcon} />}
          imageStyle={{ height: 80 }}
          description={
            <div className={styles.description}>
              <h4>No Conversations Yet</h4>
              <p>
                Start your first conversation with the AI assistant.
                <br />
                Click the button below to begin!
              </p>
            </div>
          }
        >
          {onAction && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={onAction}
              className={styles.actionButton}
            >
              {actionText || "New Conversation"}
            </Button>
          )}
        </Empty>
      </div>
    );
  };

  /**
   * Render empty messages list state with prompt suggestions
   */
  const renderEmptyMessages = () => {
    // Sample prompt suggestions
    const suggestions = [
      {
        icon: <BulbOutlined />,
        title: "Get Ideas",
        prompt: "Give me some new ideas",
      },
      {
        icon: <MessageOutlined />,
        title: "Ask Questions",
        prompt: "Explain quantum computing in simple terms",
      },
      {
        icon: <BulbOutlined />,
        title: "Solve Problems",
        prompt: "Help me debug this code error",
      },
      {
        icon: <MessageOutlined />,
        title: "Learn Something",
        prompt: "Teach me about machine learning basics",
      },
      {
        icon: <BulbOutlined />,
        title: "Summarize Text",
        prompt: "Summarize this article into 5 bullet points",
      },
      {
        icon: <MessageOutlined />,
        title: "Plan a Project",
        prompt: "Help me create a 4-step plan for a web app",
      },
    ];

    return (
      <div className={styles.emptyContainer}>
        <div className={styles.welcomeSection}>
          <div className={styles.welcomeIcon}>
            <MessageOutlined />
          </div>
          <h3 className={styles.welcomeTitle}>Start a Conversation</h3>
          <p className={styles.welcomeText}>
            I'm your AI assistant. Ask me anything or try one of these
            suggestions:
          </p>
        </div>

        {/* Prompt suggestions grid */}
        <div className={styles.suggestionsGrid}>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={styles.suggestionCard}
              onClick={() => onAction && onAction()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onAction && onAction();
                }
              }}
            >
              <div className={styles.suggestionIcon}>{suggestion.icon}</div>
              <strong className={styles.suggestionTitle}>
                {suggestion.title}
              </strong>
              <p className={styles.suggestionPrompt}>"{suggestion.prompt}"</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return type === "conversations"
    ? renderEmptyConversations()
    : renderEmptyMessages();
};

export default EmptyState;
