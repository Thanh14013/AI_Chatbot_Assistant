import React from "react";
import { Button, Input } from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import styles from "./SidebarHeader.module.css";

interface SidebarHeaderProps {
  onNewConversation: () => void;
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  onNewConversation,
  searchQuery,
  onSearchChange,
  collapsed = false,
  onToggle,
}) => {
  return (
    <div className={styles.header}>
      <div className={styles.headerTopRow}>
        {/* When collapsed, hide the New button and show only the toggle */}
        {!collapsed && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="middle"
            className={styles.newButton}
            onClick={onNewConversation}
          >
            New Conversation
          </Button>
        )}

        <button
          className={styles.inlineToggle}
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <RightOutlined className={styles.toggleIcon} />
          ) : (
            <LeftOutlined className={styles.toggleIcon} />
          )}
        </button>
      </div>

      <Input
        placeholder="Search conversations..."
        prefix={<SearchOutlined />}
        value={searchQuery}
        onChange={onSearchChange}
        className={styles.searchInput}
        size="middle"
        allowClear
      />
    </div>
  );
};

export default SidebarHeader;
