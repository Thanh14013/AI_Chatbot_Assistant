/**
 * CodeBlock Component
 * Renders code with syntax highlighting and a copy button
 */

import React, { useState } from "react";
import { Button, App } from "antd";
import { CopyOutlined, CheckOutlined } from "@ant-design/icons";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  code: string;
  language?: string;
  isUserMessage?: boolean;
}

/**
 * CodeBlock component
 * Displays code with syntax highlighting and a copy button
 */
const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = "javascript",
  isUserMessage = false,
}) => {
  const { message } = App.useApp();
  const [isCopied, setIsCopied] = useState(false);

  /**
   * Copy code to clipboard
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      message.success("Code copied to clipboard");

      // Reset copy button state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch {
      message.error("Failed to copy code");
    }
  };

  return (
    <div
      className={`${styles.codeBlockContainer} ${
        isUserMessage ? styles.userCodeBlock : ""
      }`}
    >
      {/* Code block header with language label and copy button */}
      <div className={styles.codeHeader}>
        <span className={styles.languageLabel}>{language || "code"}</span>
        <Button
          type="text"
          size="small"
          icon={isCopied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
          className={styles.copyCodeButton}
        >
          {isCopied ? "Copied!" : "Copy code"}
        </Button>
      </div>

      {/* Code content with syntax highlighting */}
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: "0 0 8px 8px",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
        showLineNumbers={true}
        wrapLines={true}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;
