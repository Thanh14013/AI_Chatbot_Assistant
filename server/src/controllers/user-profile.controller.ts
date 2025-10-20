/**
 * User Profile Controller
 * Handles HTTP requests for user profile management
 */

import { Request, Response } from "express";
import type { UpdateProfileInput, ChangePasswordInput } from "../types/user.type.js";
import {
  getUserProfile,
  updateUserProfile,
  updateUserAvatar,
  removeUserAvatar,
  changeUserPassword,
} from "../services/user-profile.service.js";

// Extend Request to include user from JWT
interface AuthRequest extends Request {
  user?: any;
}

/**
 * GET /api/users/profile
 * Get current user's profile
 */
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const profile = await getUserProfile(userId);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch profile",
    });
  }
};

/**
 * PUT /api/users/profile
 * Update profile (username, bio)
 */
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const updates: UpdateProfileInput = req.body;

    // Validate username length if provided
    if (updates.username !== undefined && updates.username !== null) {
      if (updates.username.length < 3 || updates.username.length > 50) {
        res.status(400).json({
          success: false,
          message: "Username must be between 3 and 50 characters",
        });
        return;
      }
    }

    // Validate bio length if provided
    if (updates.bio !== undefined && updates.bio !== null && updates.bio.length > 200) {
      res.status(400).json({
        success: false,
        message: "Bio must not exceed 200 characters",
      });
      return;
    }

    const updatedProfile = await updateUserProfile(userId, updates);

    res.status(200).json({
      success: true,
      data: updatedProfile,
      message: "Profile updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Username already taken") {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update profile",
    });
  }
};

/**
 * POST /api/users/avatar
 * Upload avatar
 */
export const uploadAvatarHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
      return;
    }

    const result = await updateUserAvatar(userId, req.file.buffer);

    res.status(200).json({
      success: true,
      data: result,
      message: "Avatar uploaded successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to upload avatar",
    });
  }
};

/**
 * DELETE /api/users/avatar
 * Remove avatar
 */
export const removeAvatarHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    await removeUserAvatar(userId);

    res.status(200).json({
      success: true,
      message: "Avatar removed successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "No avatar to remove") {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to remove avatar",
    });
  }
};

/**
 * PUT /api/users/change-password
 * Change password
 */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const {
      currentPassword,
      newPassword,
      confirmNewPassword,
    }: ChangePasswordInput & { confirmNewPassword?: string } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
      return;
    }

    // Validate password confirmation
    if (confirmNewPassword && newPassword !== confirmNewPassword) {
      res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
      return;
    }

    await changeUserPassword(userId, { currentPassword, newPassword });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Current password is incorrect") {
        res.status(401).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (
        error.message.includes("Password must") ||
        error.message === "New password must be different from current password"
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to change password",
    });
  }
};

export default {
  getProfile,
  updateProfile,
  uploadAvatarHandler,
  removeAvatarHandler,
  changePassword,
};
