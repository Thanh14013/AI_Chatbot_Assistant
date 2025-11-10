import React, { useMemo } from "react";
import { Avatar, Dropdown, MenuProps, Tooltip } from "antd";
import {
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useAuth } from "../hooks";
import { useNavigate } from "react-router-dom";
import type { User } from "../types/auth.type";
import styles from "./UserSection.module.css";

// Use native elements instead of AntD Typography.Text to avoid AntD EllipsisMeasure

interface UserSectionProps {
  user: User | null;
  collapsed?: boolean;
  onSettingsClick?: () => void; // Add callback for settings
  onProfileClick?: () => void; // Add callback for profile
}

const UserSection: React.FC<UserSectionProps> = ({
  user,
  collapsed = false,
  onSettingsClick,
  onProfileClick,
}) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleMenuClick = async (key: string) => {
    switch (key) {
      case "profile":
        if (onProfileClick) {
          onProfileClick();
        }
        break;
      case "settings":
        if (onSettingsClick) {
          onSettingsClick();
        }
        break;
      case "logout":
        try {
          await logout();
        } catch {
          // ignore logout errors silently
        }
        break;
    }
  };

  const menuItems: MenuProps["items"] = useMemo(
    () => [
      {
        key: "profile",
        label: "Profile",
        icon: <UserOutlined />,
        onClick: () => handleMenuClick("profile"),
      },
      {
        key: "settings",
        label: "Settings",
        icon: <SettingOutlined />,
        onClick: () => handleMenuClick("settings"),
      },
      {
        type: "divider",
      },
      {
        key: "logout",
        label: "Logout",
        icon: <LogoutOutlined />,
        danger: true,
        onClick: () => handleMenuClick("logout"),
      },
    ],
    // menu items do not depend on props
    []
  );

  if (!user) {
    return (
      <div
        className={`${styles.userSection} ${collapsed ? styles.collapsed : ""}`}
      >
        <div className={styles.userInfo}>
          <Avatar size={40} icon={<UserOutlined />} className={styles.avatar} />
          {!collapsed && (
            <div className={styles.userDetails}>
              <span className={styles.userName}>Loading...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const userContent = (
    <div
      className={`${styles.userInfo} ${collapsed ? styles.collapsed : ""}`}
      role="button"
      aria-label="Open user menu"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          // Trigger dropdown
        }
      }}
    >
      <Avatar
        size={40}
        className={styles.avatar}
        src={(user as any)?.avatarUrl}
      >
        {(user.username || user.name)?.charAt(0)?.toUpperCase() ||
          user.email?.charAt(0)?.toUpperCase() ||
          "U"}
      </Avatar>

      {!collapsed && (
        <div className={styles.userDetails}>
          {/* Use CSS-based ellipsis via styles to avoid AntD EllipsisMeasure render loops */}
          <span className={styles.userName}>
            {user.username || user.name || user.email}
          </span>
          <span className={styles.userEmail}>
            {user.username || user.name ? user.email : "Free Plan"}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`${styles.userSection} ${collapsed ? styles.collapsed : ""}`}
    >
      <Dropdown
        menu={{ items: menuItems }}
        placement="topLeft"
        trigger={["click"]}
        className={styles.dropdown}
      >
        {collapsed ? (
          <Tooltip
            title={
              <div>
                <div className={styles.tooltipTitle}>
                  {user.username || user.name || user.email}
                </div>
                <div className={styles.tooltipSubtitle}>
                  {user.username || user.name ? user.email : "Free Plan"}
                </div>
              </div>
            }
            placement="right"
          >
            {userContent}
          </Tooltip>
        ) : (
          userContent
        )}
      </Dropdown>
    </div>
  );
};

export default UserSection;
