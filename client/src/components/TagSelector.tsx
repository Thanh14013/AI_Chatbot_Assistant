/**
 * TagSelector Component
 * Allows selecting and managing conversation tags with popular suggestions
 */

import React, { useEffect, useState } from "react";
import { Select, Tag, Spin, Space, Typography } from "antd";
import { TagOutlined } from "@ant-design/icons";
import { getPopularTags, type PopularTag } from "../services/chat.service";
import styles from "./TagSelector.module.css";

const { Text } = Typography;

interface TagSelectorProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * TagSelector Component
 * Shows popular tags and allows custom tag entry
 */
export const TagSelector: React.FC<TagSelectorProps> = ({
  value = [],
  onChange,
  maxTags = 5,
  placeholder = "Select or create tags...",
  disabled = false,
}) => {
  const [popularTags, setPopularTags] = useState<PopularTag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPopularTags();
  }, []);

  const loadPopularTags = async () => {
    try {
      setLoading(true);
      const tags = await getPopularTags();
      setPopularTags(tags);
    } catch (error) {
      console.error("Failed to load popular tags:", error);
      setPopularTags([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (newTags: string[]) => {
    // Limit number of tags
    const limitedTags = newTags.slice(0, maxTags);
    onChange?.(limitedTags);
  };

  const handleSelectPopularTag = (tag: string) => {
    if (!value.includes(tag) && value.length < maxTags) {
      onChange?.([...value, tag]);
    }
  };

  return (
    <div className={styles.tagSelector}>
      <Select
        mode="tags"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled || loading}
        maxTagCount={maxTags}
        className={styles.select}
        suffixIcon={<TagOutlined />}
        notFoundContent={loading ? <Spin size="small" /> : null}
      />

      {popularTags.length > 0 && (
        <div className={styles.popularTags}>
          <Text type="secondary" className={styles.label}>
            Popular tags:
          </Text>
          <Space wrap>
            {popularTags.map((item) => (
              <Tag
                key={item.name}
                onClick={() => handleSelectPopularTag(item.name)}
                className={styles.popularTag}
                color={value.includes(item.name) ? "blue" : "default"}
              >
                {item.name} ({item.count})
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
};

export default TagSelector;
