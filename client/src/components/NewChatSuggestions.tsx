/**
 * NewChatSuggestions Component
 * Displays 3 follow-up suggestions on New Chat page based on recent messages and user info
 */

import React from "react";
import { Button, Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import styles from "./NewChatSuggestions.module.css";

interface NewChatSuggestionsProps {
  suggestions: string[];
  isLoading: boolean;
  onSuggestionClick: (suggestion: string) => void;
}

const NewChatSuggestions: React.FC<NewChatSuggestionsProps> = ({
  suggestions,
  isLoading,
  onSuggestionClick,
}) => {
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
            tip="Loading suggestions..."
          />
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    // Don't show anything if truly empty (will show default suggestions from parent)
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.suggestionsGrid}>
        {suggestions.slice(0, 3).map((suggestion, index) => (
          <Button
            key={index}
            className={styles.suggestionButton}
            onClick={() => onSuggestionClick(suggestion)}
            size="large"
          >
            <span className={styles.suggestionText}>{suggestion}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default NewChatSuggestions;
