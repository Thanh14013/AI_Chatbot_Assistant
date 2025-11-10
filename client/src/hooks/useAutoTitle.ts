/**
 * useAutoTitle Hook
 * Generates conversation titles automatically based on first message
 */

import { useState } from "react";
import { generateConversationTitle } from "../services/chat.service";

interface UseAutoTitleOptions {
  wordThreshold?: number;
}

interface UseAutoTitleReturn {
  generateTitle: (message: string) => Promise<string>;
  isGenerating: boolean;
}

/**
 * Hook for automatic conversation title generation
 * - Short messages (≤4 words): Use message itself as title
 * - Long messages (>4 words): Generate AI title
 */
export const useAutoTitle = (
  options: UseAutoTitleOptions = {}
): UseAutoTitleReturn => {
  const { wordThreshold = 4 } = options;
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTitle = async (message: string): Promise<string> => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return "New Chat";
    }

    const wordCount = trimmedMessage.split(/\s+/).length;

    // Short message: use as title
    if (wordCount <= wordThreshold) {
      return trimmedMessage;
    }

    // Long message: generate AI title
    try {
      setIsGenerating(true);
      console.log("[AutoTitle] Generating AI title for long message...");

      const title = await generateConversationTitle(trimmedMessage);

      console.log("[AutoTitle] Generated title:", title);
      return title;
    } catch (error) {
      console.error("[AutoTitle] Failed to generate AI title:", error);
      return "New Chat";
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateTitle,
    isGenerating,
  };
};

export default useAutoTitle;
