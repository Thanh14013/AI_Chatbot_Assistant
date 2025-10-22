/**
 * ChatInput Component
 * Text input area for sending chat messages with file attachments
 */

import React, { useState, useRef, useEffect } from "react";
import { Input, Button, Upload, message as antdMessage } from "antd";
import { SendOutlined, PaperClipOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import styles from "./ChatInput.module.css";
import { useFileUpload } from "../hooks/useFileUpload";
import { FileAttachmentPreview } from "./FileAttachmentPreview";
import type { FileAttachment } from "../types/file.types";

const { TextArea } = Input;

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: FileAttachment[]) => void;
  conversationId?: string;
  disabled?: boolean;
  placeholder?: string;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

/**
 * ChatInput component
 * Renders textarea with auto-resize, file upload, and send button
 */
const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  conversationId,
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

  // File upload hook
  const {
    attachments,
    uploading,
    uploadProgress,
    uploadFiles,
    removeAttachment,
    clearAttachments,
  } = useFileUpload({
    conversationId,
    onUploadSuccess: () => {
      antdMessage.success("File uploaded successfully");
    },
    onUploadError: (error) => {
      antdMessage.error(`Upload failed: ${error.message}`);
    },
  });

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
   * Handle file selection
   */
  const handleFileChange = async (file: File) => {
    try {
      await uploadFiles([file]);
    } catch (error) {}
    return false; // Prevent default upload behavior
  };

  /**
   * Handle send message action
   */
  const handleSend = () => {
    // Trim whitespace
    const trimmedMessage = message.trim();

    // Don't send if no message and no attachments
    if (
      (!trimmedMessage && attachments.length === 0) ||
      disabled ||
      uploading
    ) {
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

    // Send message with attachments to parent component
    const uploadedAttachments = attachments.filter(
      (att) => att.status === "uploaded"
    );

    onSendMessage(trimmedMessage || "Attachment", uploadedAttachments);

    // Clear input and attachments after sending
    setMessage("");
    setIsMultiline(false);
    clearAttachments();

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
      {/* File attachments preview */}
      {attachments.length > 0 && (
        <FileAttachmentPreview
          attachments={attachments}
          onRemove={removeAttachment}
          uploadProgress={uploadProgress}
        />
      )}

      <div
        className={`${styles.inputWrapper} ${
          isMultiline ? styles.multiline : ""
        }`}
      >
        {/* File upload button */}
        <Upload
          beforeUpload={handleFileChange}
          showUploadList={false}
          multiple
          disabled={disabled || uploading}
        >
          <Button
            type="text"
            icon={<PaperClipOutlined />}
            disabled={disabled || uploading}
            className={styles.attachButton}
            title="Attach files"
          />
        </Upload>

        {/* Textarea with auto-resize */}
        <TextArea
          ref={textAreaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || uploading}
          autoSize={{ minRows: 1, maxRows: 4 }}
          maxLength={MAX_CHARS}
          className={styles.textarea}
        />

        {/* Send button */}
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={
            disabled ||
            uploading ||
            (!message.trim() && attachments.length === 0)
          }
          loading={disabled || uploading}
          className={styles.sendButton}
        ></Button>
      </div>

      {/* Hint text */}
      <div className={styles.hintText}>
        Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for
        new line
        {uploading && <span> • Uploading files...</span>}
      </div>
    </div>
  );
};

export default ChatInput;
