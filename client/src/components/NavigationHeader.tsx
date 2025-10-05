/**
 * Navigation Header Component
 * Displays user information and logout button
 */

import React from "react";
import { Layout, Button, Avatar, Dropdown, Space, Typography } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useAuth } from "../hooks";
import styles from "./NavigationHeader.module.css";

const { Header } = Layout;
const { Text } = Typography;

/**
 * NavigationHeader component
 * Renders header with user info and logout functionality
 */
const NavigationHeader: React.FC = () => {
  const { user, logout, isLoading } = useAuth();

  /**
   * Handle logout button click
   */
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  /**
   * Dropdown menu items for user menu
   */
  const menuItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Profile",
      disabled: true, // Disabled until profile page is implemented
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings",
      disabled: true, // Disabled until settings page is implemented
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <Header className={styles.header}>
      <div className={styles.container}>
        {/* Logo/Brand */}
        <div className={styles.brand}>
          <Text className={styles.brandText}>AI Chatbot Assistant</Text>
        </div>

        {/* User Menu */}
        <div className={styles.userMenu}>
          <Space size="middle">
            {/* User Info */}
            <Dropdown menu={{ items: menuItems }} placement="bottomRight">
              <Button
                type="text"
                className={styles.userButton}
                loading={isLoading}
              >
                <Space>
                  <Avatar
                    size="small"
                    icon={<UserOutlined />}
                    className={styles.avatar}
                  />
                  <Text className={styles.userName}>
                    {user?.name || user?.email || "User"}
                  </Text>
                </Space>
              </Button>
            </Dropdown>

            {/* Logout Button (Mobile) */}
            <Button
              type="primary"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              loading={isLoading}
              className={styles.logoutButtonMobile}
            >
              Logout
            </Button>
          </Space>
        </div>
      </div>
    </Header>
  );
};

export default NavigationHeader;
