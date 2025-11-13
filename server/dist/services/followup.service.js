import openai from "./openai.service.js";
const followupCache = new Map();
export const generateFollowupSuggestions = async (lastUserMessage, lastBotMessage) => {
    const cacheKey = `${lastUserMessage}::${lastBotMessage}`;
    const cached = followupCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    try {
        const prompt = `Dựa vào cuộc hội thoại:

User: "${lastUserMessage}"
Assistant: "${lastBotMessage}"

Hãy tạo đúng 3 câu hỏi follow-up ngắn gọn, tự nhiên, sáng tạo liên quan đến nội dung trên.
Chỉ trả về danh sách 3 câu hỏi, mỗi câu 1 dòng, không cần số thứ tự hay ký tự đặc biệt.
3 câu hỏi này là 3 câu với vai trò là người dùng, danh xưng là tôi, hỏi trợ lý ảo.`;
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
        content = content.trim();
        if (content.startsWith("```")) {
            content = content
                .replace(/^```(?:json|txt)?\s*/i, "")
                .replace(/```\s*$/, "")
                .trim();
        }
        let suggestions = [];
        const lines = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        for (const line of lines) {
            const cleaned = line
                .replace(/^\d+[\.\)\:\-\s]+/, "")
                .replace(/^[\-\u2022\*\+]\s*/, "")
                .replace(/^["'\u201C\u201D\u2018\u2019]|["'\u201C\u201D\u2018\u2019]$/g, "")
                .trim();
            if (cleaned.length > 5) {
                suggestions.push(cleaned);
            }
            if (suggestions.length >= 3) {
                break;
            }
        }
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
        suggestions = suggestions.slice(0, 3);
        followupCache.set(cacheKey, suggestions);
        if (followupCache.size > 100) {
            const firstKey = followupCache.keys().next().value;
            if (firstKey) {
                followupCache.delete(firstKey);
            }
        }
        return suggestions;
    }
    catch (error) {
        return [
            "Can you explain that in more detail?",
            "What else should I know about this?",
            "How can I use this information?",
        ];
    }
};
export const generateConversationFollowups = async (messages) => {
    const recentMessages = messages.slice(-10);
    const cacheKey = recentMessages.map((m) => `${m.role}:${m.content}`).join("|");
    const cached = followupCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    try {
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
            model: "gpt-5-nano",
            messages: [
                {
                    role: "system",
                    content: "You generate exactly 3 follow-up questions from the user's perspective (first person), one per line, without numbering or special characters.",
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
        content = content.trim();
        if (content.startsWith("```")) {
            content = content
                .replace(/^```(?:json|txt)?\s*/i, "")
                .replace(/```\s*$/, "")
                .trim();
        }
        let suggestions = [];
        const lines = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        for (const line of lines) {
            const cleaned = line
                .replace(/^\d+[\.\)\:\-\s]+/, "")
                .replace(/^[\-\u2022\*\+]\s*/, "")
                .replace(/^["'\u201C\u201D\u2018\u2019]|["'\u201C\u201D\u2018\u2019]$/g, "")
                .trim();
            if (cleaned.length > 5) {
                suggestions.push(cleaned);
            }
            if (suggestions.length >= 3) {
                break;
            }
        }
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
        suggestions = suggestions.slice(0, 3);
        followupCache.set(cacheKey, suggestions);
        if (followupCache.size > 100) {
            const firstKey = followupCache.keys().next().value;
            if (firstKey) {
                followupCache.delete(firstKey);
            }
        }
        return suggestions;
    }
    catch (error) {
        return [
            "Bạn có thể giải thích chi tiết hơn không?",
            "Tôi nên biết thêm gì về điều này?",
            "Làm thế nào để tôi áp dụng thông tin này?",
        ];
    }
};
export const clearFollowupCache = () => {
    followupCache.clear();
};
