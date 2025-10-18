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
    const prompt = `Based on the following conversation:
- User: ${lastUserMessage}
- Assistant: ${lastBotMessage}

Suggest 3 concise and natural follow-up questions the user might ask next.
Return only the questions, as a JSON array of strings.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_completion_tokens: 200,
    });

    const content = response.choices[0]?.message?.content || "";

    if (!content.trim()) {
      throw new Error("OpenAI returned empty content for follow-ups");
    }

    let suggestions: string[] = [];

    // Try to parse as JSON array first
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter((s: any) => typeof s === "string").slice(0, 3);
      }
    } catch {
      // If JSON parsing fails, fall back to line-by-line parsing
      suggestions = content
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0 && !line.match(/^\d+[\.\)]/))
        .slice(0, 3);
    }

    // Ensure we have exactly 3 suggestions
    if (suggestions.length < 3) {
      const defaults = [
        "Can you explain that in more detail?",
        "What else should I know about this?",
        "How can I use this information?",
      ];
      while (suggestions.length < 3) {
        suggestions.push(defaults[suggestions.length] || "Tell me more");
      }
    }

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
    console.error("Failed to generate follow-up suggestions:", error.message);

    // Return default suggestions on error
    return [
      "Can you explain that in more detail?",
      "What else should I know about this?",
      "How can I use this information?",
    ];
  }
};

/**
 * Clear the follow-up cache (useful for testing or memory management)
 */
export const clearFollowupCache = (): void => {
  followupCache.clear();
};
