/**
 * SelectionAskButton Component
 * Displays a floating button when user selects text in AI message
 * Allows user to ask AI to explain the selected text
 */

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
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
  /** Content hash to detect content changes (for streaming messages) */
  contentKey?: string | number;
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
  contentKey,
}) => {
  const [selectedText, setSelectedText] = useState<string>("");
  const [buttonPosition, setButtonPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Use useLayoutEffect to check if containerRef is ready after DOM updates
  // This ensures we don't miss the ref being set
  // Effect re-runs when messageId OR contentKey changes (new message or content update)
  useLayoutEffect(() => {
    console.log("[SelectionAskButton] useLayoutEffect triggered", {
      messageId,
      contentKey,
      isAIMessage,
      hasContainer: !!containerRef.current,
    });

    // Use a small timeout to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      if (containerRef.current && isAIMessage) {
        console.log(
          "[SelectionAskButton] Setting isReady=true for message",
          messageId
        );
        setIsReady(true);
      } else {
        console.log(
          "[SelectionAskButton] Setting isReady=false for message",
          messageId
        );
        setIsReady(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isAIMessage, messageId, contentKey]); // Added contentKey to detect content changes

  useEffect(() => {
    console.log("[SelectionAskButton] Main effect triggered", {
      messageId,
      isAIMessage,
      isReady,
      hasContainer: !!containerRef.current,
    });

    if (!isAIMessage || !isReady || !containerRef.current) {
      console.log(
        "[SelectionAskButton] Early return - not attaching listeners"
      );
      return;
    }

    const container = containerRef.current;
    console.log(
      "[SelectionAskButton] Attaching event listeners for message",
      messageId
    );

    const handleSelection = (event: MouseEvent) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || "";

      // Only show button if text is selected and has at least 3 characters
      if (text.length >= 3) {
        const range = selection?.getRangeAt(0);

        // Check if selection is within our container
        if (
          range &&
          container?.contains(range?.commonAncestorContainer as Node)
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

    // Listen for mouseup on the message container (not document)
    // This prevents conflicts between multiple SelectionAskButton instances
    container.addEventListener("mouseup", handleSelection);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      container.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAIMessage, isReady, messageId, contentKey]); // Added contentKey

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
