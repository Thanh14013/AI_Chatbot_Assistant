/**
 * TypingIndicator Component
 * Animated typing indicator with bouncing dots animation
 */

import React from "react";
import styles from "./TypingIndicator.module.css";

interface TypingIndicatorProps {
  show?: boolean;
  message?: string;
  size?: "small" | "medium" | "large";
  className?: string;
}

/**
 * TypingIndicator component
 * Shows animated dots with customizable message and size
 */
const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  show = false,
  message = "",
  size = "medium",
  className = "",
}) => {
  if (!show) return null;

  return (
    <div className={`${styles.typingIndicator} ${styles[size]} ${className}`}>
      {/* show message text only if provided; default is empty to hide the label */}
      {message ? <span className={styles.message}>{message}</span> : null}
      <div className={styles.dotsContainer}>
        <div className={`${styles.dot} ${styles.dot1}`}></div>
        <div className={`${styles.dot} ${styles.dot2}`}></div>
        <div className={`${styles.dot} ${styles.dot3}`}></div>
      </div>
    </div>
  );
};

export default TypingIndicator;
