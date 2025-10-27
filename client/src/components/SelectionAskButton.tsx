/**
 * SelectionAskButton Component
 * Displays a floating button when user selects text in AI message
 * Allows user to ask AI to explain the selected text
 */

import React, { useState, useEffect, useRef } from "react";
import { Button, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import styles from "./SelectionAskButton.module.css";

interface SelectionAskButtonProps {
  /** The container element to monitor for text selection */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Callback when user clicks the ask button */
  onAskAboutSelection: (selectedText: string) => void;
  /** Only show for AI messages (not user messages) */
  isAIMessage: boolean;
  /** Message ID to track changes and re-attach listeners */
  messageId?: string;
}

/**
 * SelectionAskButton component
 * Shows a floating button when text is selected in AI message bubbles
 */
const SelectionAskButton: React.FC<SelectionAskButtonProps> = ({
  containerRef,
  onAskAboutSelection,
  isAIMessage,
  messageId,
}) => {
  const [selectedText, setSelectedText] = useState<string>("");
  const [buttonPosition, setButtonPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAIMessage || !containerRef.current) return;

    const handleSelection = (event: MouseEvent) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || "";

      // Only show button if text is selected and has at least 3 characters
      if (text.length >= 3) {
        const range = selection?.getRangeAt(0);

        // Check if selection is within our container
        if (
          range &&
          containerRef.current?.contains(range?.commonAncestorContainer as Node)
        ) {
          // Position button at mouse cursor position (where user released)
          setButtonPosition({
            top: event.pageY + 5, // Below mouse cursor
            left: event.pageX + 5, // Right of mouse cursor
          });
          setSelectedText(text);
        } else {
          setButtonPosition(null);
          setSelectedText("");
        }
      } else {
        setButtonPosition(null);
        setSelectedText("");
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      // Hide button if click is outside button and selection
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim().length === 0) {
          setButtonPosition(null);
          setSelectedText("");
        }
      }
    };

    // Only listen for mouseup - show button when user releases mouse after selection
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAIMessage, containerRef, messageId]);

  const handleAskClick = () => {
    if (selectedText) {
      onAskAboutSelection(selectedText);
      // Clear selection and hide button
      window.getSelection()?.removeAllRanges();
      setButtonPosition(null);
      setSelectedText("");
    }
  };

  if (!buttonPosition || !isAIMessage) return null;

  return (
    <>
      <style>
        {`
          .${styles.floatingButton}[data-position="true"] {
            top: ${buttonPosition.top}px;
            left: ${buttonPosition.left}px;
          }
        `}
      </style>
      <div
        ref={buttonRef}
        className={styles.floatingButton}
        data-position="true"
      >
        <Tooltip title="Ask AI to explain this" placement="top">
          <Button
            type="primary"
            shape="circle"
            icon={<QuestionCircleOutlined />}
            onClick={handleAskClick}
            className={styles.askButton}
            size="small"
          />
        </Tooltip>
      </div>
    </>
  );
};

export default SelectionAskButton;
