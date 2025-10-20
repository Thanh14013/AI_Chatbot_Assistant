/**
 * User Profile API Service
 * Handles profile-related API calls
 */

import axiosInstance from "./axios.service";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  username?: string | null;
  bio?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword?: string;
}

export interface AvatarUploadResponse {
  avatar_url: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Get current user's profile
 */
export const getUserProfile = async (): Promise<ApiResponse<UserProfile>> => {
  const response = await axiosInstance.get("/users/profile");
  return response.data;
};

/**
 * Update user profile (username, bio)
 */
export const updateUserProfile = async (
  updates: UpdateProfileInput
): Promise<ApiResponse<UserProfile>> => {
  const response = await axiosInstance.put("/users/profile", updates);
  return response.data;
};

/**
 * Upload avatar
 */
export const uploadAvatar = async (
  file: File
): Promise<ApiResponse<AvatarUploadResponse>> => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await axiosInstance.post("/users/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Remove avatar
 */
export const removeAvatar = async (): Promise<ApiResponse<null>> => {
  const response = await axiosInstance.delete("/users/avatar");
  return response.data;
};

/**
 * Change password
 */
export const changePassword = async (
  data: ChangePasswordInput
): Promise<ApiResponse<null>> => {
  const response = await axiosInstance.put("/users/change-password", data);
  return response.data;
};

export default {
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  removeAvatar,
  changePassword,
};
