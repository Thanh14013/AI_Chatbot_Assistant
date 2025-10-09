import React, { useState, useEffect, useRef } from "react";
import {
  Layout,
  Button,
  Input,
  List,
  Avatar,
  Spin,
  Typography,
  Dropdown,
  Menu,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  MessageOutlined,
  LoadingOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useAuth } from "../hooks";
import styles from "./Sidebar.module.css";

const { Sider } = Layout;
const { Text } = Typography;

type Conversation = {
  id: string;
  title: string;
  lastAt?: string;
  unread?: number;
  updatedAt?: string;
};

type SidebarProps = {
  conversations?: Conversation[];
  currentConversation?: Conversation | null;
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  searchQuery?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading?: boolean;
  loadMore?: () => void;
  hasMore?: boolean;
};

const Sidebar: React.FC<SidebarProps> = ({
  conversations = [],
  currentConversation = null,
  onSelectConversation,
  onNewConversation,
  searchQuery = "",
  onSearchChange,
  isLoading = false,
  loadMore,
  hasMore,
}) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const { user, logout } = useAuth();

  // Keep selected in sync when parent selection changes
  useEffect(() => {
    setSelected(currentConversation?.id ?? null);
  }, [currentConversation]);

  // Format time display
  const formatTime = (dateString?: string) => {
    if (!dateString) return "Recently";

    const date = new Date(dateString);
    const now = new Date();
    const diffInHours =
      Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  // handle scroll detection for showing Load More button
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    // consider bottom reached if within 16px of end
    const atBottom = scrollTop + clientHeight >= scrollHeight - 16;
    setIsScrolledToBottom(atBottom);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // if content does not overflow, consider it "at bottom" so the button can appear when hasMore
    if (el.scrollHeight <= el.clientHeight) setIsScrolledToBottom(true);
    const onScroll = () => handleScroll();
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [conversations]);

  // Auto-infinite-load: when user reaches bottom and there are more items, call loadMore()
  const loadingMoreRef = useRef(false);
  useEffect(() => {
    if (!hasMore) return;
    if (!isScrolledToBottom) return;
    if (isLoading) return;
    if (loadingMoreRef.current) return;
    if (!loadMore) return;

    loadingMoreRef.current = true;
    const p = Promise.resolve(loadMore());
    p.finally(() => {
      loadingMoreRef.current = false;
      // After new items render, re-evaluate scroll state
      setTimeout(() => {
        const el = listRef.current;
        if (!el) return;
        if (el.scrollHeight <= el.clientHeight) setIsScrolledToBottom(true);
        else handleScroll();
      }, 200);
    });
  }, [isScrolledToBottom, hasMore, isLoading, loadMore]);

  return (
    <Sider trigger={null} width={320} className={styles.sidebar}>
      {/* TOP SECTION: Controls */}
      <div className={styles.topSection}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          size="large"
          className={styles.newBtn}
          onClick={onNewConversation}
        >
          New Conversation
        </Button>

        <Input
          placeholder="Search conversations..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={onSearchChange}
          className={styles.searchInput}
          size="large"
          allowClear
        />
      </div>

      {/* MIDDLE SECTION: Scrollable Conversations List */}
      <div className={styles.middleSection}>
        {isLoading && conversations.length === 0 ? (
          <div className={styles.loadingContainer}>
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
              tip="Loading conversations..."
            />
          </div>
        ) : conversations.length === 0 ? (
          <div className={styles.emptyState}>
            <MessageOutlined className={styles.emptyIcon} />
            <Text className={styles.emptyText}>
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </Text>
            <Text className={styles.emptySubtext}>
              {searchQuery
                ? "Try a different search term"
                : "Start a new conversation to get started"}
            </Text>
          </div>
        ) : (
          <div className={styles.conversationsList} ref={listRef}>
            <List
              dataSource={conversations}
              renderItem={(conversation) => {
                const isActive = selected === conversation.id;
                return (
                  <List.Item className={styles.listItem}>
                    <div
                      className={`${styles.conversationItem} ${
                        isActive ? styles.active : ""
                      }`}
                      onClick={() => {
                        setSelected(conversation.id);
                        onSelectConversation?.(conversation.id);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(conversation.id);
                          onSelectConversation?.(conversation.id);
                        }
                      }}
                    >
                      <Avatar
                        shape="square"
                        size={40}
                        className={styles.avatar}
                        icon={<MessageOutlined />}
                      />

                      <div className={styles.conversationMeta}>
                        <div className={styles.titleRow}>
                          <Text className={styles.conversationTitle} ellipsis>
                            {conversation.title || "Untitled"}
                          </Text>
                          <Text className={styles.timeText}>
                            {formatTime(
                              conversation.updatedAt || conversation.lastAt
                            )}
                          </Text>
                        </div>

                        {conversation.unread && conversation.unread > 0 ? (
                          <Text
                            className={styles.conversationSubtitle}
                            ellipsis
                          >
                            {`${conversation.unread} new message${
                              conversation.unread > 1 ? "s" : ""
                            }`}
                          </Text>
                        ) : null}
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        )}

        {/* Show Load More when user has scrolled to bottom (or content doesn't overflow) */}
        {hasMore && isScrolledToBottom && (
          <div className={styles.loadMoreContainer}>
            <Button
              block
              size="large"
              loading={isLoading}
              onClick={loadMore}
              className={styles.loadMoreBtn}
            >
              Read more
            </Button>
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: Fixed User info (avatar + name) */}
      <div className={styles.bottomSection}>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item key="profile" icon={<UserOutlined />}>
                Profile
              </Menu.Item>
              <Menu.Item key="settings" icon={<SettingOutlined />} disabled>
                Settings
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                key="logout"
                icon={<LogoutOutlined />}
                danger
                onClick={async () => {
                  try {
                    await logout();
                  } catch (err) {
                    // logout handled in hook
                  }
                }}
              >
                Logout
              </Menu.Item>
            </Menu>
          }
          placement="topLeft"
          trigger={["click"]}
        >
          <div
            className={styles.userRow}
            role="button"
            aria-label="Open user menu"
            tabIndex={0}
          >
            <Avatar
              size={40}
              className={styles.userAvatar}
              src={(user as any)?.avatarUrl}
            >
              {(user as any)?.name?.charAt(0) ||
                (user as any)?.email?.charAt(0) ||
                "U"}
            </Avatar>

            <div className={styles.userInfo}>
              <Text className={styles.userName} ellipsis>
                {(user as any)?.name || (user as any)?.email || "User"}
              </Text>
              <Text className={styles.userSub} ellipsis>
                {(user as any)?.role || "Free"}
              </Text>
            </div>
          </div>
        </Dropdown>
      </div>
    </Sider>
  );
};

export default Sidebar;
