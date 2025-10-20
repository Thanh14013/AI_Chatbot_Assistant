import UserPreference from "../models/user-preference.model.js";
import type {
  UserPreferenceResponse,
  UpdateUserPreferenceInput,
} from "../types/user-preference.type.js";

/**
 * Get user preferences
 * If preferences don't exist, create default preferences
 *
 * @param userId - User ID
 * @returns User preferences
 */
export const getUserPreferences = async (userId: string): Promise<UserPreferenceResponse> => {
  console.log(`⚙️  [PREFERENCES] Fetching preferences for user: ${userId}`);

  // Try to find existing preferences
  let preferences = await UserPreference.findByUserId(userId);

  // If preferences don't exist, create default preferences
  if (!preferences) {
    console.log(`⚙️  [PREFERENCES] No preferences found, creating defaults for user: ${userId}`);
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
  console.log(`⚙️  [PREFERENCES] Updating preferences for user: ${userId}`);

  // Validate language if provided
  const validLanguages = ["en", "vi", "es", "fr", "de", "ja", "ko", "zh"];
  if (updates.language && !validLanguages.includes(updates.language)) {
    throw new Error(`Invalid language code. Supported languages: ${validLanguages.join(", ")}`);
  }

  // Validate response_style if provided
  const validStyles = ["concise", "detailed", "balanced", "casual", "professional"];
  if (updates.response_style && !validStyles.includes(updates.response_style)) {
    throw new Error(`Invalid response style. Supported styles: ${validStyles.join(", ")}`);
  }

  // Validate custom_instructions length if provided
  if (updates.custom_instructions && updates.custom_instructions.length > 2000) {
    throw new Error("Custom instructions cannot exceed 2000 characters");
  }

  // Use upsert to create or update preferences
  const preferences = await UserPreference.upsertPreferences(userId, updates);

  console.log(`✅ [PREFERENCES] Preferences updated successfully for user: ${userId}`);

  return {
    id: preferences.id,
    user_id: preferences.user_id,
    language: preferences.language,
    response_style: preferences.response_style,
    custom_instructions: preferences.custom_instructions,
    createdAt: preferences.createdAt,
    updatedAt: preferences.updatedAt,
  };
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

    let systemPrompt = basePrompt;

    // Add language preference
    if (preferences.language !== "en") {
      const languageNames: Record<string, string> = {
        vi: "Vietnamese",
        es: "Spanish",
        fr: "French",
        de: "German",
        ja: "Japanese",
        ko: "Korean",
        zh: "Chinese",
      };
      const languageName = languageNames[preferences.language] || preferences.language;
      systemPrompt += `\n\nIMPORTANT: Respond in ${languageName} language.`;
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
      systemPrompt += `\n\nResponse Style: ${styleInstructions[preferences.response_style]}`;
    }

    // Add custom instructions if provided
    if (preferences.custom_instructions && preferences.custom_instructions.trim()) {
      systemPrompt += `\n\nAdditional Instructions: ${preferences.custom_instructions.trim()}`;
    }

    return systemPrompt;
  } catch (error) {
    // If preferences fetch fails, return base prompt
    console.error(`❌ [PREFERENCES] Failed to fetch preferences for user ${userId}:`, error);
    return basePrompt;
  }
};
