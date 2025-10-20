import { Request, Response } from "express";
import { getUserPreferences, updateUserPreferences } from "../services/user-preference.service.js";
import type { UpdateUserPreferenceInput } from "../types/user-preference.type.js";

/**
 * Get user preferences
 * GET /api/users/preferences
 */
export const getPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from authenticated user
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const preferences = await getUserPreferences(userId);

    res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch preferences";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * Update user preferences
 * PUT /api/users/preferences
 */
export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from authenticated user
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const updates: UpdateUserPreferenceInput = req.body;

    // Validate that at least one field is provided
    if (!updates.language && !updates.response_style && updates.custom_instructions === undefined) {
      res.status(400).json({
        success: false,
        message: "At least one preference field must be provided",
      });
      return;
    }

    const preferences = await updateUserPreferences(userId, updates);

    res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      data: preferences,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update preferences";

    // Return 400 for validation errors
    if (
      errorMessage.includes("Invalid") ||
      errorMessage.includes("exceed") ||
      errorMessage.includes("Supported")
    ) {
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};
