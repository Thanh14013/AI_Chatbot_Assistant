/**
 * User Profile Service
 * Handles profile management: get, update, avatar upload, password change
 */

import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import type {
  UserResponse,
  UpdateProfileInput,
  ChangePasswordInput,
  AvatarUploadResponse,
} from "../types/user.type.js";
import { uploadAvatar, deleteAvatar } from "./cloudinary.service.js";
import { deleteCache } from "./cache.service.js";
import { userByIdKey, userByEmailKey } from "../utils/cache-key.util.js";

/**
 * Get user profile by ID
 */
export const getUserProfile = async (userId: string): Promise<UserResponse> => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ["password"] }, // Never expose password
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username || null,
    bio: user.bio || null,
    avatar_url: user.avatar_url || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

/**
 * Update user profile (username, bio)
 */
export const updateUserProfile = async (
  userId: string,
  updates: UpdateProfileInput
): Promise<UserResponse> => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Validate username uniqueness if changing
  if (updates.username && updates.username !== user.username) {
    const existingUser = await User.findByUsername(updates.username);
    if (existingUser && existingUser.id !== userId) {
      throw new Error("Username already taken");
    }
  }

  // Sanitize bio (strip HTML, trim whitespace)
  if (updates.bio !== undefined) {
    updates.bio = sanitizeBio(updates.bio);
  }

  // Update user
  await user.update(updates);

  // Invalidate cache to ensure fresh data on next login
  await deleteCache(userByIdKey(user.id));
  await deleteCache(userByEmailKey(user.email));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username || null,
    bio: user.bio || null,
    avatar_url: user.avatar_url || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

/**
 * Upload user avatar to Cloudinary
 */
export const updateUserAvatar = async (
  userId: string,
  fileBuffer: Buffer
): Promise<AvatarUploadResponse> => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Delete old avatar from Cloudinary if exists
  if (user.avatar_url) {
    try {
      await deleteAvatar(user.avatar_url);
    } catch (error) {
      // Log but don't fail (old avatar might already be deleted)
    }
  }

  // Upload new avatar to Cloudinary
  const avatarUrl = await uploadAvatar(fileBuffer, userId);

  // Update user record
  await user.update({ avatar_url: avatarUrl });

  // Invalidate cache to ensure fresh data on next login
  await deleteCache(userByIdKey(user.id));
  await deleteCache(userByEmailKey(user.email));

  return { avatar_url: avatarUrl };
};

/**
 * Remove user avatar
 */
export const removeUserAvatar = async (userId: string): Promise<void> => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.avatar_url) {
    throw new Error("No avatar to remove");
  }

  // Delete from Cloudinary
  try {
    await deleteAvatar(user.avatar_url);
  } catch (error) {
    // Log but continue (avatar might already be deleted)
  }

  // Update user record
  await user.update({ avatar_url: null });

  // Invalidate cache to ensure fresh data on next login
  await deleteCache(userByIdKey(user.id));
  await deleteCache(userByEmailKey(user.email));
};

/**
 * Change user password
 */
export const changeUserPassword = async (
  userId: string,
  data: ChangePasswordInput
): Promise<void> => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, user.password);

  if (!isCurrentPasswordValid) {
    throw new Error("Current password is incorrect");
  }

  // Validate new password strength
  validatePasswordStrength(data.newPassword);

  // Check if new password is same as current
  const isSameAsCurrentPassword = await bcrypt.compare(data.newPassword, user.password);

  if (isSameAsCurrentPassword) {
    throw new Error("New password must be different from current password");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(data.newPassword, 10);

  // Update password
  await user.update({ password: hashedPassword });

  // Invalidate cache to ensure fresh password hash on next login
  await deleteCache(userByIdKey(user.id));
  await deleteCache(userByEmailKey(user.email));
};

/**
 * Validate password strength
 */
const validatePasswordStrength = (password: string): void => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (password.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters long`);
  }

  if (!hasUpperCase) {
    throw new Error("Password must contain at least one uppercase letter");
  }

  if (!hasLowerCase) {
    throw new Error("Password must contain at least one lowercase letter");
  }

  if (!hasNumber) {
    throw new Error("Password must contain at least one number");
  }
};

/**
 * Sanitize bio text
 */
const sanitizeBio = (bio: string | null): string | null => {
  if (!bio) return null;

  // Strip HTML tags
  let sanitized = bio.replace(/<[^>]*>/g, "");

  // Trim whitespace
  sanitized = sanitized.trim();

  // Return null if empty after sanitization
  return sanitized || null;
};

export default {
  getUserProfile,
  updateUserProfile,
  updateUserAvatar,
  removeUserAvatar,
  changeUserPassword,
};
