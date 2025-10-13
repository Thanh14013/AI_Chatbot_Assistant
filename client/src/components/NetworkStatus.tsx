/**
 * NetworkStatus Component
 * Shows online/offline status and connection state
 */

import React, { useState, useEffect } from "react";
import {
  WifiOutlined,
  DisconnectOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Badge, Tooltip } from "antd";
import { useWebSocket } from "../hooks/useWebSocket";
import styles from "./NetworkStatus.module.css";

export type NetworkStatusType =
  | "online"
  | "offline"
  | "connecting"
  | "reconnecting";

interface NetworkStatusProps {
  showText?: boolean;
  size?: "small" | "medium" | "large";
  className?: string;
  position?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "inline";
}

/**
 * NetworkStatus component
 * Shows current network and WebSocket connection status
 */
const NetworkStatus: React.FC<NetworkStatusProps> = ({
  showText = false,
  size = "small",
  className = "",
  position = "inline",
}) => {
  const [networkStatus, setNetworkStatus] =
    useState<NetworkStatusType>("online");
  const { isConnected } = useWebSocket({ enabled: false }); // Just check status, don't auto-connect

  // Monitor network status
  useEffect(() => {
    const updateNetworkStatus = () => {
      if (!navigator.onLine) {
        setNetworkStatus("offline");
      } else if (!isConnected) {
        setNetworkStatus("connecting");
      } else {
        setNetworkStatus("online");
      }
    };

    // Initial check
    updateNetworkStatus();

    // Listen for network changes
    const handleOnline = () => {
      if (isConnected) {
        setNetworkStatus("online");
      } else {
        setNetworkStatus("connecting");
      }
    };

    const handleOffline = () => {
      setNetworkStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check connection status periodically
    const interval = setInterval(updateNetworkStatus, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [isConnected]);

  const getStatusConfig = () => {
    switch (networkStatus) {
      case "online":
        return {
          icon: <WifiOutlined />,
          color: "success" as const,
          text: "Online",
          // tooltip removed for inline usage per UX request
          tooltip: "",
          badgeColor: "#52c41a",
        };
      case "offline":
        return {
          icon: <DisconnectOutlined />,
          color: "error" as const,
          text: "Offline",
          tooltip: "No internet connection",
          badgeColor: "#ff4d4f",
        };
      case "connecting":
        return {
          icon: <LoadingOutlined className={styles.spinning} />,
          color: "processing" as const,
          text: "Connecting",
          tooltip: "Connecting to server...",
          badgeColor: "#1890ff",
        };
      case "reconnecting":
        return {
          icon: <LoadingOutlined className={styles.spinning} />,
          color: "warning" as const,
          text: "Reconnecting",
          tooltip: "Reconnecting to server...",
          badgeColor: "#faad14",
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();

  if (!config) return null;

  const statusElement = (
    <div
      className={`${styles.networkStatus} ${styles[size]} ${styles[position]} ${className}`}
    >
      <Badge color={config.badgeColor} />
      <span className={styles.icon}>{config.icon}</span>
      {showText && <span className={styles.text}>{config.text}</span>}
    </div>
  );

  // For inline placement (chat header) we don't show the tooltip or icons as requested.
  if (position === "inline") {
    // If the caller explicitly requests text, show only the text (no badge/icon/tooltip).
    if (showText) {
      return (
        <div
          className={`${styles.networkStatus} ${styles[size]} ${styles[position]} ${className}`}
        >
          <span className={styles.text}>{config.text}</span>
        </div>
      );
    }
    // Otherwise render nothing for inline position (removes green dot and wifi icon)
    return null;
  }

  return (
    <Tooltip title={config.tooltip} placement="top">
      {statusElement}
    </Tooltip>
  );
};

export default NetworkStatus;
