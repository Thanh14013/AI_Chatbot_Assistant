import UserPreference from "../models/user-preference.model.js";
import type {
  UserPreferenceResponse,
  UpdateUserPreferenceInput,
} from "../types/user-preference.type.js";

/**
 * Sanitize HTML/script tags from string to prevent XSS
 */
const sanitizeInput = (input: string | null | undefined): string | null => {
  if (!input) return null;

  // Remove HTML tags and script content
  const sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();

  return sanitized || null;
};

/**
 * Trim and clean string input
 */
const cleanString = (input: string | null | undefined): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Get user preferences
 * If preferences don't exist, create default preferences
 *
 * @param userId - User ID
 * @returns User preferences
 */
export const getUserPreferences = async (userId: string): Promise<UserPreferenceResponse> => {
  try {
    // Try to find existing preferences
    let preferences = await UserPreference.findByUserId(userId);

    // If preferences don't exist, create default preferences
    if (!preferences) {
      preferences = await UserPreference.create({
        user_id: userId,
        language: "vi",
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
  } catch (error) {
    throw new Error("Failed to fetch user preferences. Please try again.");
  }
};

/**
 * Update user preferences
 *
 * @param userId - User ID
 * @param updates - Preference updates
 * @returns Updated user preferences
 */
export const updateUserPreferences = async (
  userId: string,
  updates: UpdateUserPreferenceInput
): Promise<UserPreferenceResponse> => {
  try {
    // Clean and sanitize inputs
    const cleanedUpdates: UpdateUserPreferenceInput = {};

    if (updates.language !== undefined) {
      cleanedUpdates.language = cleanString(updates.language) || undefined;
    }

    if (updates.response_style !== undefined) {
      cleanedUpdates.response_style = cleanString(updates.response_style) || undefined;
    }

    if (updates.custom_instructions !== undefined) {
      // Sanitize custom instructions to prevent XSS
      const cleaned = cleanString(updates.custom_instructions);
      cleanedUpdates.custom_instructions = cleaned ? sanitizeInput(cleaned) : null;
    }

    // Validate language if provided
    const validLanguages = ["en", "vi", "es", "fr", "de", "ja", "ko", "zh"];
    if (cleanedUpdates.language && !validLanguages.includes(cleanedUpdates.language)) {
      throw new Error(
        `Invalid language code: "${cleanedUpdates.language}". Supported languages: ${validLanguages.join(", ")}`
      );
    }

    // Validate response_style if provided
    const validStyles = ["concise", "detailed", "balanced", "casual", "professional"];
    if (cleanedUpdates.response_style && !validStyles.includes(cleanedUpdates.response_style)) {
      throw new Error(
        `Invalid response style: "${cleanedUpdates.response_style}". Supported styles: ${validStyles.join(", ")}`
      );
    }

    // Validate custom_instructions length if provided
    if (cleanedUpdates.custom_instructions && cleanedUpdates.custom_instructions.length > 2000) {
      throw new Error(
        `Custom instructions are too long (${cleanedUpdates.custom_instructions.length} characters). Maximum allowed: 2000 characters.`
      );
    }

    // Use upsert to create or update preferences
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
  } catch (error) {
    // Re-throw validation errors with original message
    if (error instanceof Error && error.message.includes("Invalid")) {
      throw error;
    }

    // Re-throw length validation errors
    if (error instanceof Error && error.message.includes("too long")) {
      throw error;
    }

    // Generic error for database issues
    throw new Error("Failed to update preferences. Please try again.");
  }
};

/**
 * Build system prompt with user preferences
 * Applies language, response style, and custom instructions to the base system prompt
 *
 * @param userId - User ID
 * @param basePrompt - Base system prompt (optional)
 * @returns Enhanced system prompt with user preferences
 */
export const buildSystemPromptWithPreferences = async (
  userId: string,
  basePrompt: string = "You are a helpful AI assistant. Provide clear, accurate, and helpful responses."
): Promise<string> => {
  try {
    const preferences = await getUserPreferences(userId);

    // Start with language instruction FIRST (highest priority)
    const languageNames: Record<string, string> = {
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

    // ⚠️ CRITICAL: ABSOLUTE LANGUAGE ENFORCEMENT - HIGHEST PRIORITY
    // This MUST be the first instruction and CANNOT be overridden by context or user messages
    let systemPrompt = `🔴 ABSOLUTE REQUIREMENT - LANGUAGE ENFORCEMENT 🔴
YOU MUST RESPOND EXCLUSIVELY IN ${languageName.toUpperCase()} LANGUAGE.

MANDATORY RULES:
1. EVERY single response MUST be written in ${languageName} - NO EXCEPTIONS
2. IGNORE the language of previous messages in the conversation history
3. IGNORE the language used by the user in their current or past messages  
4. DO NOT mix languages - use ONLY ${languageName}
5. Even if the user writes in a different language, you MUST respond in ${languageName}
6. This language requirement OVERRIDES all other instructions

Current User's Selected Language: ${languageName}
Your Response Language: ${languageName}

${basePrompt}`;

    // Add custom instructions IMMEDIATELY after language (high priority)
    if (preferences.custom_instructions && preferences.custom_instructions.trim()) {
      systemPrompt += `\n\n📋 USER'S CUSTOM INSTRUCTIONS (High Priority):\n${preferences.custom_instructions.trim()}`;
    }

    // Add response style preference
    const styleInstructions: Record<string, string> = {
      concise: "Keep your responses brief and to the point. Avoid unnecessary details.",
      detailed:
        "Provide comprehensive and detailed responses. Include examples and explanations where appropriate.",
      balanced:
        "Provide clear responses with appropriate level of detail. Balance brevity with completeness.",
      casual:
        "Use a friendly, conversational tone. Feel free to use casual language and be personable.",
      professional:
        "Maintain a professional and formal tone. Use proper terminology and structured responses.",
    };

    if (preferences.response_style && styleInstructions[preferences.response_style]) {
      systemPrompt += `\n\n💬 Response Style: ${styleInstructions[preferences.response_style]}`;
    }

    // Add CODE FORMATTING instruction - CRITICAL for proper code rendering
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

    // 🔴 FINAL LANGUAGE REMINDER - ABSOLUTE ENFORCEMENT
    systemPrompt += `\n\n🔴 FINAL REMINDER - CRITICAL LANGUAGE REQUIREMENT 🔴
Your ONLY allowed response language is: ${languageName.toUpperCase()}
- Do NOT use Vietnamese if the user selected French
- Do NOT use English if the user selected Japanese  
- Do NOT use any language other than ${languageName}
- This is an ABSOLUTE requirement that CANNOT be violated
- Responding in the wrong language is a CRITICAL ERROR

Response Language: ${languageName} (MANDATORY)`;

    return systemPrompt;
  } catch (error) {
    // If preferences fetch fails, return base prompt
    return basePrompt;
  }
};
