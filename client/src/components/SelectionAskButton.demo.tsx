/**
 * Demo component to test SelectionAskButton functionality
 */

import React, { useRef } from "react";
import SelectionAskButton from "./SelectionAskButton";

const SelectionAskButtonDemo: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAskAboutSelection = (question: string, selectedText: string) => {


    alert(`Question: ${question}\nSelected: ${selectedText}`);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px" }}>
      <h2>SelectionAskButton Demo</h2>
      <p>Select some text in the AI message below to see the Ask AI button:</p>

      <div
        ref={containerRef}
        style={{
          padding: "16px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          background: "#f9f9f9",
          marginTop: "20px",
        }}
      >
        <p>
          <strong>AI Response:</strong> This is an AI-generated message. You can
          select any text in this message to ask questions about it. For
          example, select the word "AI-generated" or "message" and click the Ask
          AI button that appears.
        </p>
        <p>
          The button should appear when you select text, and when you click it,
          an inline input should appear at the same position while the button
          disappears. The input should be compact and close when you click
          outside.
        </p>
      </div>

      <SelectionAskButton
        containerRef={containerRef}
        onAskAboutSelection={handleAskAboutSelection}
        isAIMessage={true}
        messageId="demo-message"
      />
    </div>
  );
};

export default SelectionAskButtonDemo;
