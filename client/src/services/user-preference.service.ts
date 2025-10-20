/**
 * User Preference Service
 * Handles API calls for user preferences
 */

import axiosInstance from "./axios.service";
import type { ApiResponse } from "../types";

/**
 * User Preference Response Type
 */
export interface UserPreference {
  id: string;
  user_id: string;
  language: string;
  response_style: string;
  custom_instructions: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get User Preferences Response
 */
export interface GetUserPreferencesResponse extends ApiResponse {
  success: boolean;
  message: string;
  data: UserPreference;
}

/**
 * Update User Preferences Input
 */
export interface UpdateUserPreferencesInput {
  language?: string;
  response_style?: string;
  custom_instructions?: string | null;
}

/**
 * Update User Preferences Response
 */
export interface UpdateUserPreferencesResponse extends ApiResponse {
  success: boolean;
  message: string;
  data: UserPreference;
}

/**
 * Get user preferences
 */
export const getUserPreferences =
  async (): Promise<GetUserPreferencesResponse> => {
    const response = await axiosInstance.get<GetUserPreferencesResponse>(
      "/users/preferences"
    );
    return response.data;
  };

/**
 * Update user preferences
 */
export const updateUserPreferences = async (
  preferences: UpdateUserPreferencesInput
): Promise<UpdateUserPreferencesResponse> => {
  const response = await axiosInstance.put<UpdateUserPreferencesResponse>(
    "/users/preferences",
    preferences
  );
  return response.data;
};

/**
 * Language options for the selector
 */
export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "zh", label: "中文" },
];

/**
 * Response style options for the selector
 */
export const RESPONSE_STYLE_OPTIONS = [
  { value: "concise", label: "Concise", description: "Brief and to the point" },
  {
    value: "detailed",
    label: "Detailed",
    description: "Comprehensive with examples",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Clear with appropriate detail",
  },
  {
    value: "casual",
    label: "Casual",
    description: "Friendly and conversational",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Formal and structured",
  },
];
