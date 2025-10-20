import { Router } from "express";
import { getPreferences, updatePreferences } from "../controllers/user-preference.controller.js";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
const router = Router();
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
export default router;
