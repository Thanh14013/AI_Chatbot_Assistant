/**
 * Smart Suggestions Component
 * Displays AI-generated conversation starters based on user's memory profile
 */

import React, { useEffect, useState } from "react";
import { Card, Button, Space, Typography, Spin, message } from "antd";
import { BulbOutlined, ReloadOutlined } from "@ant-design/icons";
import { getSmartSuggestions } from "../services/memory.service";
import styles from "./SmartSuggestions.module.css";

const { Text } = Typography;

interface SmartSuggestionsProps {
  onSelectSuggestion?: (suggestion: string) => void;
  maxSuggestions?: number;
}

/**
 * SmartSuggestions Component
 * Shows personalized conversation starters based on user interests
 */
export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
  onSelectSuggestion,
  maxSuggestions = 5,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [basedOn, setBasedOn] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const response = await getSmartSuggestions(maxSuggestions);

      if (response.success && response.data) {
        setSuggestions(response.data.suggestions || []);
        setBasedOn(response.data.basedOn || []);
      }
    } catch (error) {
      // Silently fail - suggestions are not critical
      console.error("Failed to load smart suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [maxSuggestions]);

  const handleSelectSuggestion = (suggestion: string) => {
    if (onSelectSuggestion) {
      onSelectSuggestion(suggestion);
      message.success("Suggestion applied!");
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="small" />
        <Text type="secondary">Loading suggestions...</Text>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card
      className={styles.suggestionsCard}
      size="small"
      title={
        <Space>
          <BulbOutlined />
          <span>Smart Suggestions</span>
        </Space>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={loadSuggestions}
          loading={loading}
        >
          Refresh
        </Button>
      }
    >
      {basedOn.length > 0 && (
        <Text type="secondary" className={styles.basedOnText}>
          Based on: {basedOn.join(", ")}
        </Text>
      )}

      <Space direction="vertical" className={styles.suggestionsSpace}>
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            type="default"
            className={styles.suggestionButton}
            onClick={() => handleSelectSuggestion(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </Space>
    </Card>
  );
};

export default SmartSuggestions;
