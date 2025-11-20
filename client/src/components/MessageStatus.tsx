/**
 * MessageStatus Component
 * Shows message status indicators (sending, sent, error)
 */

import React from "react";
import {
  LoadingOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import styles from "./MessageStatus.module.css";

export type MessageStatusType = "sending" | "sent" | "error" | "pending";

interface MessageStatusProps {
  status: MessageStatusType;
  size?: "small" | "medium" | "large";
  showTooltip?: boolean;
  className?: string;
  onRetry?: () => void;
}

/**
 * MessageStatus component
 * Displays appropriate icon based on message status
 */
const MessageStatus: React.FC<MessageStatusProps> = ({
  status,
  size = "small",
  showTooltip = true,
  className = "",
  onRetry,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case "sending":
        return {
          icon: <LoadingOutlined className={styles.spinning} />,
          color: "var(--ant-color-text-tertiary)",
          tooltip: "Sending message...",
          className: styles.sending,
        };
      case "sent":
        return {
          icon: <CheckOutlined />,
          color: "var(--ant-color-success)",
          tooltip: "Message sent",
          className: styles.sent,
        };
      case "error":
        return {
          icon: <ExclamationCircleOutlined />,
          color: "var(--ant-color-error)",
          tooltip: onRetry
            ? "Failed to send. Click to retry"
            : "Failed to send",
          className: styles.error,
        };
      case "pending":
        return {
          icon: <ClockCircleOutlined />,
          color: "var(--ant-color-warning)",
          tooltip: "Message pending...",
          className: styles.pending,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();

  if (!config) return null;

  const iconElement =
    status === "error" && onRetry ? (
      <button
        type="button"
        className={`${styles.messageStatus} ${styles[size]} ${config.className} ${className} ${styles.retryButton}`}
        onClick={onRetry}
      >
        {config.icon}
      </button>
    ) : (
      <span
        className={`${styles.messageStatus} ${styles[size]} ${config.className} ${className}`}
      >
        {config.icon}
      </span>
    );

  if (!showTooltip) {
    return iconElement;
  }

  return (
    <Tooltip
      title={config.tooltip}
      placement="top"
      getPopupContainer={(trigger) => trigger.parentElement || document.body}
    >
      {iconElement}
    </Tooltip>
  );
};

export default MessageStatus;
