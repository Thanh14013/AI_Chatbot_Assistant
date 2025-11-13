import UserPreference from "../models/user-preference.model.js";
const sanitizeInput = (input) => {
    if (!input)
        return null;
    const sanitized = input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<[^>]+>/g, "")
        .trim();
    return sanitized || null;
};
const cleanString = (input) => {
    if (!input)
        return null;
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : null;
};
export const getUserPreferences = async (userId) => {
    try {
        let preferences = await UserPreference.findByUserId(userId);
        if (!preferences) {
            preferences = await UserPreference.create({
                user_id: userId,
                language: "en",
                response_style: "balanced",
                custom_instructions: null,
            });
        }
        return {
            id: preferences.id,
            user_id: preferences.user_id,
            language: preferences.language,
            response_style: preferences.response_style,
            custom_instructions: preferences.custom_instructions,
            createdAt: preferences.createdAt,
            updatedAt: preferences.updatedAt,
        };
    }
    catch (error) {
        throw new Error("Failed to fetch user preferences. Please try again.");
    }
};
export const updateUserPreferences = async (userId, updates) => {
    try {
        const cleanedUpdates = {};
        if (updates.language !== undefined) {
            cleanedUpdates.language = cleanString(updates.language) || undefined;
        }
        if (updates.response_style !== undefined) {
            cleanedUpdates.response_style = cleanString(updates.response_style) || undefined;
        }
        if (updates.custom_instructions !== undefined) {
            const cleaned = cleanString(updates.custom_instructions);
            cleanedUpdates.custom_instructions = cleaned ? sanitizeInput(cleaned) : null;
        }
        const validLanguages = ["en", "vi", "es", "fr", "de", "ja", "ko", "zh"];
        if (cleanedUpdates.language && !validLanguages.includes(cleanedUpdates.language)) {
            throw new Error(`Invalid language code: "${cleanedUpdates.language}". Supported languages: ${validLanguages.join(", ")}`);
        }
        const validStyles = ["concise", "detailed", "balanced", "casual", "professional"];
        if (cleanedUpdates.response_style && !validStyles.includes(cleanedUpdates.response_style)) {
            throw new Error(`Invalid response style: "${cleanedUpdates.response_style}". Supported styles: ${validStyles.join(", ")}`);
        }
        if (cleanedUpdates.custom_instructions && cleanedUpdates.custom_instructions.length > 2000) {
            throw new Error(`Custom instructions are too long (${cleanedUpdates.custom_instructions.length} characters). Maximum allowed: 2000 characters.`);
        }
        const preferences = await UserPreference.upsertPreferences(userId, cleanedUpdates);
        return {
            id: preferences.id,
            user_id: preferences.user_id,
            language: preferences.language,
            response_style: preferences.response_style,
            custom_instructions: preferences.custom_instructions,
            createdAt: preferences.createdAt,
            updatedAt: preferences.updatedAt,
        };
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("Invalid")) {
            throw error;
        }
        if (error instanceof Error && error.message.includes("too long")) {
            throw error;
        }
        throw new Error("Failed to update preferences. Please try again.");
    }
};
export const buildSystemPromptWithPreferences = async (userId, basePrompt = "You are a helpful AI assistant. Provide clear, accurate, and helpful responses.") => {
    try {
        const preferences = await getUserPreferences(userId);
        const languageNames = {
            en: "English",
            vi: "Vietnamese",
            es: "Spanish",
            fr: "French",
            de: "German",
            ja: "Japanese",
            ko: "Korean",
            zh: "Chinese",
        };
        const languageName = languageNames[preferences.language] || "English";
        let systemPrompt = `CRITICAL INSTRUCTION: You MUST respond ONLY in ${languageName} language. All your responses must be in ${languageName}, regardless of the language used in previous messages or context.\n\n${basePrompt}`;
        systemPrompt += `\n\n📝 CRITICAL CODE FORMATTING RULE:
When providing ANY code in your response, you MUST ALWAYS wrap it in markdown code blocks with triple backticks and language identifier.

Required format: \`\`\`language
your code here
\`\`\`

Examples:
- C++ code: \`\`\`cpp
#include <iostream>
int main() { return 0; }
\`\`\`

- Python code: \`\`\`python
def hello():
    print("Hello")
\`\`\`

- JavaScript: \`\`\`javascript
const x = 10;
\`\`\`

- Java: \`\`\`java
public class Main {}
\`\`\`

- SQL: \`\`\`sql
SELECT * FROM users;
\`\`\`

- Shell/Bash: \`\`\`bash
npm install
\`\`\`

- Any other code: \`\`\`plaintext
your code
\`\`\`

⚠️ IMPORTANT: This applies to ALL code snippets - even single lines, commands, or code fragments. NEVER provide raw code without the triple backtick wrapper and language identifier. This is essential for proper syntax highlighting and user experience.`;
        const styleInstructions = {
            concise: "Keep your responses brief and to the point. Avoid unnecessary details.",
            detailed: "Provide comprehensive and detailed responses. Include examples and explanations where appropriate.",
            balanced: "Provide clear responses with appropriate level of detail. Balance brevity with completeness.",
            casual: "Use a friendly, conversational tone. Feel free to use casual language and be personable.",
            professional: "Maintain a professional and formal tone. Use proper terminology and structured responses.",
        };
        if (preferences.response_style && styleInstructions[preferences.response_style]) {
            systemPrompt += `\n\nResponse Style: ${styleInstructions[preferences.response_style]}`;
        }
        if (preferences.custom_instructions && preferences.custom_instructions.trim()) {
            systemPrompt += `\n\nAdditional Instructions: ${preferences.custom_instructions.trim()}`;
        }
        systemPrompt += `\n\n🌍 REMINDER: Your response language is ${languageName}. Do not switch to any other language.`;
        return systemPrompt;
    }
    catch (error) {
        return basePrompt;
    }
};
