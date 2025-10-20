/**
 * User Preference Interface
 * Defines the structure for user preferences
 */
export interface IUserPreference {
  id: string;
  user_id: string;
  language: string;
  response_style: string;
  custom_instructions: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Preference Response (DTO for API responses)
 */
export interface UserPreferenceResponse {
  id: string;
  user_id: string;
  language: string;
  response_style: string;
  custom_instructions: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Update User Preference Input
 */
export interface UpdateUserPreferenceInput {
  language?: string;
  response_style?: string;
  custom_instructions?: string | null;
}

/**
 * Response style options
 */
export type ResponseStyle = "concise" | "detailed" | "balanced" | "casual" | "professional";

/**
 * Supported language codes
 */
export type LanguageCode = "en" | "vi" | "es" | "fr" | "de" | "ja" | "ko" | "zh";
