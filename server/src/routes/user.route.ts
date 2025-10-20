import { Router } from "express";
import { getPreferences, updatePreferences } from "../controllers/user-preference.controller.js";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";
import {
  getProfile,
  updateProfile,
  uploadAvatarHandler,
  removeAvatarHandler,
  changePassword,
} from "../controllers/user-profile.controller.js";

const router = Router();

// ==================== PREFERENCES ROUTES ====================

/**
 * Get user preferences
 * GET /api/users/preferences
 */
router.get("/preferences", authenticateAccessToken, getPreferences);

/**
 * Update user preferences
 * PUT /api/users/preferences
 */
router.put("/preferences", authenticateAccessToken, updatePreferences);

// ==================== PROFILE ROUTES ====================

/**
 * Get user profile
 * GET /api/users/profile
 */
router.get("/profile", authenticateAccessToken, getProfile);

/**
 * Update user profile (username, bio)
 * PUT /api/users/profile
 */
router.put("/profile", authenticateAccessToken, updateProfile);

/**
 * Upload avatar
 * POST /api/users/avatar
 */
router.post("/avatar", authenticateAccessToken, uploadSingle, uploadAvatarHandler);

/**
 * Remove avatar
 * DELETE /api/users/avatar
 */
router.delete("/avatar", authenticateAccessToken, removeAvatarHandler);

/**
 * Change password
 * PUT /api/users/change-password
 */
router.put("/change-password", authenticateAccessToken, changePassword);

export default router;
