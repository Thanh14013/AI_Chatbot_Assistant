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

    // CRITICAL: Language instruction at the very beginning with STRONG emphasis
    let systemPrompt = `CRITICAL INSTRUCTION: You MUST respond ONLY in ${languageName} language. All your responses must be in ${languageName}, regardless of the language used in previous messages or context.\n\n${basePrompt}`;

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
      systemPrompt += `\n\nResponse Style: ${styleInstructions[preferences.response_style]}`;
    }

    // Add custom instructions if provided
    if (preferences.custom_instructions && preferences.custom_instructions.trim()) {
      systemPrompt += `\n\nAdditional Instructions: ${preferences.custom_instructions.trim()}`;
    }

    // REINFORCE language instruction at the end
    systemPrompt += `\n\n🌍 REMINDER: Your response language is ${languageName}. Do not switch to any other language.`;

    return systemPrompt;
  } catch (error) {
    // If preferences fetch fails, return base prompt
    return basePrompt;
  }
};
