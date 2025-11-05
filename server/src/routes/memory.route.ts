/**
 * Memory Routes
 * API endpoints for Long Term Memory operations
 */

import { Router } from "express";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
import {
  getProfile,
  getEvents,
  getSuggestions,
  clearMemory,
  getStats,
  getConfig,
} from "../controllers/memory.controller.js";

const router = Router();

/**
 * @route   GET /api/memory/profile
 * @desc    Get user profile with facts
 * @access  Private
 */
router.get("/profile", authenticateAccessToken, getProfile);

/**
 * @route   GET /api/memory/events
 * @desc    Get memory events (paginated)
 * @access  Private
 */
router.get("/events", authenticateAccessToken, getEvents);

/**
 * @route   GET /api/memory/suggestions
 * @desc    Get smart chat suggestions
 * @access  Private
 */
router.get("/suggestions", authenticateAccessToken, getSuggestions);

/**
 * @route   DELETE /api/memory/clear
 * @desc    Clear all user memory
 * @access  Private
 */
router.delete("/clear", authenticateAccessToken, clearMemory);

/**
 * @route   GET /api/memory/stats
 * @desc    Get memory statistics
 * @access  Private
 */
router.get("/stats", authenticateAccessToken, getStats);

/**
 * @route   GET /api/memory/config
 * @desc    Get LTM configuration
 * @access  Private
 */
router.get("/config", authenticateAccessToken, getConfig);

export default router;
