/**
 * AskAIModal Component
 * Inline input to ask AI about selected text (GitHub Copilot style)
 */

import React, { useState, useRef, useEffect } from "react";
import { Input, Button } from "antd";
import { SendOutlined, CloseOutlined } from "@ant-design/icons";
import styles from "./AskAIModal.module.css";

interface AskAIModalProps {
  visible: boolean;
  position: { top: number; left: number } | null;
  selectedText: string;
  onClose: () => void;
  onSubmit: (question: string, selectedText: string) => void;
  disabled?: boolean;
}

/**
 * AskAIModal component (actually an inline input, not a modal)
 * Compact input box that appears next to the Ask AI button
 */
const AskAIModal: React.FC<AskAIModalProps> = ({
  visible,
  position,
  selectedText,
  onClose,
  onSubmit,
  disabled = false,
}) => {
  const [question, setQuestion] = useState("");
  const inputRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when visible
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuestion(""); // Clear input when closed
    }
  }, [visible]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        visible &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [visible, onClose]);

  const handleSubmit = () => {
    const trimmedQuestion = question.trim();
    if (trimmedQuestion) {
      onSubmit(trimmedQuestion, selectedText);
      setQuestion("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!visible || !position) return null;

  return (
    <>
      <style>
        {`
          .${styles.inlineInput}[data-position="true"] {
            top: ${position.top}px;
            left: ${position.left}px;
          }
        `}
      </style>
      <div
        ref={containerRef}
        className={styles.inlineInput}
        data-position="true"
      >
        <div className={styles.inputWrapper}>
          <Input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI..."
            className={styles.input}
            suffix={
              <div className={styles.actions}>
                <Button
                  type="text"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={handleSubmit}
                  disabled={!question.trim() || disabled}
                  className={styles.sendButton}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={onClose}
                  className={styles.closeButton}
                />
              </div>
            }
          />
        </div>
      </div>
    </>
  );
};

export default AskAIModal;
