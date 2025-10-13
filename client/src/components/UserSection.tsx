import React, { useMemo } from "react";
import { Avatar, Dropdown, MenuProps } from "antd";
import {
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useAuth } from "../hooks";
import type { User } from "../types/auth.type";
import styles from "./UserSection.module.css";

// Use native elements instead of AntD Typography.Text to avoid AntD EllipsisMeasure

interface UserSectionProps {
  user: User | null;
}

const UserSection: React.FC<UserSectionProps> = ({ user }) => {
  const { logout } = useAuth();

  const handleMenuClick = async (key: string) => {
    switch (key) {
      case "profile":
        // TODO: Navigate to profile page
        break;
      case "settings":
        // TODO: Navigate to settings page
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
      <div className={styles.userSection}>
        <div className={styles.userInfo}>
          <Avatar size={40} icon={<UserOutlined />} className={styles.avatar} />
          <div className={styles.userDetails}>
            <span className={styles.userName}>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.userSection}>
      <Dropdown
        menu={{ items: menuItems }}
        placement="topLeft"
        trigger={["click"]}
        className={styles.dropdown}
      >
        <div
          className={styles.userInfo}
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
            {user.name?.charAt(0)?.toUpperCase() ||
              user.email?.charAt(0)?.toUpperCase() ||
              "U"}
          </Avatar>

          <div className={styles.userDetails}>
            {/* Use CSS-based ellipsis via styles to avoid AntD EllipsisMeasure render loops */}
            <span className={styles.userName}>{user.name || user.email}</span>
            <span className={styles.userEmail}>
              {user.name ? user.email : "Free Plan"}
            </span>
          </div>
        </div>
      </Dropdown>
    </div>
  );
};

export default UserSection;
