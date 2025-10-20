import openai from "./openai.service.js";
// In-memory cache for follow-up suggestions
const followupCache = new Map();
/**
 * Generate follow-up suggestions based on conversation context
 * Uses OpenAI to generate 3 natural, concise follow-up questions
 *
 * @param lastUserMessage - The user's last message in the conversation
 * @param lastBotMessage - The bot's response to generate follow-ups for
 * @returns Array of 3 follow-up suggestions
 */
export const generateFollowupSuggestions = async (lastUserMessage, lastBotMessage) => {
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
Chỉ trả về danh sách 3 câu hỏi, mỗi câu 1 dòng, không cần số thứ tự hay ký tự đặc biệt.`;
        const response = await openai.chat.completions.create({
            model: "gpt-5-nano",
            messages: [
                {
                    role: "system",
                    content: "You generate exactly 3 follow-up questions, one per line, without numbering or special characters.",
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
        let suggestions = [];
        // Split by newlines first
        const lines = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
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
    }
    catch (error) {
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
 * Clear the follow-up cache (useful for testing or memory management)
 */
export const clearFollowupCache = () => {
    followupCache.clear();
};
