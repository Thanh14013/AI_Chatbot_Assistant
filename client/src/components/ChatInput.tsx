/**
 * ChatInput Component
 * Text input area for sending chat messages
 */

import React, { useState, useRef, useEffect } from "react";
import { Input, Button } from "antd";
import { SendOutlined } from "@ant-design/icons";
import styles from "./ChatInput.module.css";

const { TextArea } = Input;

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

/**
 * ChatInput component
 * Renders textarea with auto-resize and send button
 */
const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message here...",
  onTypingStart,
  onTypingStop,
}) => {
  const [message, setMessage] = useState("");
  const [isMultiline, setIsMultiline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const textAreaRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Maximum character limit (optional)
  const MAX_CHARS = 4000;

  /**
   * Handle textarea value change
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Detect if textarea has multiple lines (contains newlines or is tall)
    const hasNewlines = value.includes("\n");
    const lineCount = value.split("\n").length;
    const isTall = textAreaRef.current?.scrollHeight > 40; // 40px is single line height
    setIsMultiline(hasNewlines || lineCount > 1 || isTall);

    // Handle typing events
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      onTypingStart?.();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTypingStop?.();
    }, 3000);
  };

  /**
   * Handle send message action
   */
  const handleSend = () => {
    // Trim whitespace
    const trimmedMessage = message.trim();

    // Don't send empty messages
    if (!trimmedMessage || disabled) {
      return;
    }

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      onTypingStop?.();
    }

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Send message to parent component
    onSendMessage(trimmedMessage);

    // Clear input after sending
    setMessage("");
    setIsMultiline(false);

    // Focus back to textarea
    textAreaRef.current?.focus();
  };

  /**
   * Handle keyboard shortcuts
   * - Enter: Send message
   * - Shift + Enter: New line
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Auto-focus textarea when component mounts
   */
  useEffect(() => {
    textAreaRef.current?.focus();

    // Cleanup typing timeout on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.chatInputContainer}>
      <div
        className={`${styles.inputWrapper} ${
          isMultiline ? styles.multiline : ""
        }`}
      >
        {/* Textarea with auto-resize */}
        <TextArea
          ref={textAreaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoSize={{ minRows: 1, maxRows: 4 }}
          maxLength={MAX_CHARS}
          className={styles.textarea}
        />

        {/* Send button */}
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          loading={disabled}
          className={styles.sendButton}
        ></Button>
      </div>

      {/* Hint text */}
      <div className={styles.hintText}>
        Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for
        new line
      </div>
    </div>
  );
};

export default ChatInput;
