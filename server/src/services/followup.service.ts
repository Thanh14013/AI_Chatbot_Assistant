import openai from "./openai.service.js";

// In-memory cache for follow-up suggestions
const followupCache = new Map<string, string[]>();

/**
 * Generate follow-up suggestions based on conversation context
 * Uses OpenAI to generate 3 natural, concise follow-up questions
 *
 * @param lastUserMessage - The user's last message in the conversation
 * @param lastBotMessage - The bot's response to generate follow-ups for
 * @returns Array of 3 follow-up suggestions
 */
export const generateFollowupSuggestions = async (
  lastUserMessage: string,
  lastBotMessage: string
): Promise<string[]> => {
  // Create cache key from both messages
  const cacheKey = `${lastUserMessage}::${lastBotMessage}`;

  // Check cache first
  const cached = followupCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Simplified prompt: ONLY request plain text numbered list
    const prompt = `Dựa vào cuộc hội thoại:

User: "${lastUserMessage}"
Assistant: "${lastBotMessage}"

Hãy tạo đúng 3 câu hỏi follow-up ngắn gọn, tự nhiên, sáng tạo liên quan đến nội dung trên.
Chỉ trả về danh sách 3 câu hỏi, mỗi câu 1 dòng, không cần số thứ tự hay ký tự đặc biệt.
3 câu hỏi này là 3 câu với vai trò là người dùng, danh xưng là tôi, hỏi trợ lý ảo.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You generate exactly 3 follow-up questions, one per line, without numbering or special characters.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_completion_tokens: 2000,
      temperature: 1,
    });

    let content = response.choices[0]?.message?.content || "";
    if (!content.trim()) {
      throw new Error("OpenAI returned empty content for follow-ups");
    }

    // logging removed

    // Clean up content: remove markdown code blocks if present
    content = content.trim();
    if (content.startsWith("```")) {
      content = content
        .replace(/^```(?:json|txt)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
    }

    // logging removed

    // Parse suggestions from text
    let suggestions: string[] = [];

    // Split by newlines first
    const lines = content
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    // Clean each line: remove numbering, bullets, quotes
    for (const line of lines) {
      const cleaned = line
        .replace(/^\d+[\.\)\:\-\s]+/, "") // Remove "1. " "1) " "1: " "1- " "1 "
        .replace(/^[\-\u2022\*\+]\s*/, "") // Remove "- " "• " "* " "+ "
        .replace(/^["'\u201C\u201D\u2018\u2019]|["'\u201C\u201D\u2018\u2019]$/g, "") // Remove quotes
        .trim();

      if (cleaned.length > 5) {
        // Must be meaningful
        suggestions.push(cleaned);
      }

      // Stop after getting 3 suggestions
      if (suggestions.length >= 3) {
        break;
      }
    }

    // logging removed

    // Ensure we have exactly 3 suggestions
    if (suggestions.length < 3) {
      // logging removed
      const defaults = [
        "Can you explain that in more detail?",
        "What else should I know about this?",
        "How can I use this information?",
      ];
      while (suggestions.length < 3) {
        suggestions.push(defaults[suggestions.length] || "Tell me more");
      }
    }

    // Take only first 3
    suggestions = suggestions.slice(0, 3);

    // logging removed

    // Cache the result
    followupCache.set(cacheKey, suggestions);

    // Limit cache size to prevent memory issues
    if (followupCache.size > 100) {
      const firstKey = followupCache.keys().next().value;
      if (firstKey) {
        followupCache.delete(firstKey);
      }
    }

    return suggestions;
  } catch (error: any) {
    // logging removed

    // Return default suggestions on error
    return [
      "Can you explain that in more detail?",
      "What else should I know about this?",
      "How can I use this information?",
    ];
  }
};

/**
 * Generate follow-up suggestions based on conversation history
 * Uses up to 10 recent messages to understand context and generate relevant questions
 * from the user's perspective (first person)
 *
 * @param messages - Array of recent messages (up to 10, ordered from oldest to newest)
 * @returns Array of 3 follow-up question suggestions
 */
export const generateConversationFollowups = async (
  messages: Array<{ role: string; content: string }>
): Promise<string[]> => {
  // Limit to 10 messages
  const recentMessages = messages.slice(-10);

  // Create cache key from message contents
  const cacheKey = recentMessages.map((m) => `${m.role}:${m.content}`).join("|");

  // Check cache first
  const cached = followupCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Build conversation context string
    const conversationContext = recentMessages
      .map((m) => {
        const speaker = m.role === "user" ? "Tôi" : "Bạn";
        return `${speaker}: "${m.content}"`;
      })
      .join("\n");

    const prompt = `Dựa vào lịch sử hội thoại sau đây:

${conversationContext}

Hãy tạo đúng 3 câu hỏi tiếp theo mà tôi (người dùng) có thể hỏi bạn (trợ lý AI).
Các câu hỏi phải:
- Ngắn gọn, tự nhiên, sáng tạo
- Liên quan đến nội dung đã thảo luận
- Dùng ngôi xưng "tôi" cho người dùng và "bạn" cho AI
- Chỉ trả về 3 câu hỏi, mỗi câu 1 dòng, không cần số thứ tự hay ký tự đặc biệt`;

    const response = await openai.chat.completions.create({
      model: "GPT-5 mini",
      messages: [
        {
          role: "system",
          content:
            "You generate exactly 3 follow-up questions from the user's perspective (first person), one per line, without numbering or special characters.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_completion_tokens: 2000,
      temperature: 1,
    });

    let content = response.choices[0]?.message?.content || "";
    if (!content.trim()) {
      throw new Error("OpenAI returned empty content for conversation follow-ups");
    }

    // Clean up content: remove markdown code blocks if present
    content = content.trim();
    if (content.startsWith("```")) {
      content = content
        .replace(/^```(?:json|txt)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
    }

    // Parse suggestions from text
    let suggestions: string[] = [];

    // Split by newlines first
    const lines = content
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    // Clean each line: remove numbering, bullets, quotes
    for (const line of lines) {
      const cleaned = line
        .replace(/^\d+[\.\)\:\-\s]+/, "") // Remove "1. " "1) " "1: " "1- " "1 "
        .replace(/^[\-\u2022\*\+]\s*/, "") // Remove "- " "• " "* " "+ "
        .replace(/^["'\u201C\u201D\u2018\u2019]|["'\u201C\u201D\u2018\u2019]$/g, "") // Remove quotes
        .trim();

      if (cleaned.length > 5) {
        // Must be meaningful
        suggestions.push(cleaned);
      }

      // Stop after getting 3 suggestions
      if (suggestions.length >= 3) {
        break;
      }
    }

    // Ensure we have exactly 3 suggestions
    if (suggestions.length < 3) {
      const defaults = [
        "Bạn có thể giải thích chi tiết hơn không?",
        "Tôi nên biết thêm gì về điều này?",
        "Làm thế nào để tôi áp dụng thông tin này?",
      ];
      while (suggestions.length < 3) {
        suggestions.push(defaults[suggestions.length] || "Cho tôi biết thêm");
      }
    }

    // Take only first 3
    suggestions = suggestions.slice(0, 3);

    // Cache the result
    followupCache.set(cacheKey, suggestions);

    // Limit cache size to prevent memory issues
    if (followupCache.size > 100) {
      const firstKey = followupCache.keys().next().value;
      if (firstKey) {
        followupCache.delete(firstKey);
      }
    }

    return suggestions;
  } catch (error: any) {
    // Return default suggestions on error
    return [
      "Bạn có thể giải thích chi tiết hơn không?",
      "Tôi nên biết thêm gì về điều này?",
      "Làm thế nào để tôi áp dụng thông tin này?",
    ];
  }
};

/**
 * Clear the follow-up cache (useful for testing or memory management)
 */
export const clearFollowupCache = (): void => {
  followupCache.clear();
};
