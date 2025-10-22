import { Router } from "express";
import { register, login, refresh, logout, getCurrentUser, } from "../controllers/auth.controller.js";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
const router = Router();
/**
 * POST /api/auth/register
 * Register a new user
 * Body: { name, email, password, confirmPassword? }
 */
router.post("/register", register);
/**
 * POST /api/auth/login
 * Login user and get tokens
 * Body: { email, password }
 */
router.post("/login", login);
/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * Body: { refreshToken }
 */
router.post("/refresh", refresh);
/**
 * POST /api/auth/logout
 * Revoke refresh token (logout)
 * Body: { refreshToken }
 */
router.post("/logout", logout);
/**
 * GET /api/auth/me
 * Get current authenticated user
 * Requires: Access token in Authorization header
 */
router.get("/me", authenticateAccessToken, getCurrentUser);
export default router;
