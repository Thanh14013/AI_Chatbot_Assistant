/**
 * Authentication Controller
 * Handles user registration, login, logout, token refresh, and user profile retrieval
 */

import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
} from "../services/auth.service.js";
import User from "../models/user.model.js";
import type { RegisterInput, LoginInput } from "../types/user.type.js";

/**
 * Register a new user
 * POST /api/auth/register
 * @body {string} name - User's full name
 * @body {string} email - User's email address
 * @body {string} password - User's password (min 6 characters)
 * @body {string} confirmPassword - Password confirmation (optional)
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, confirmPassword }: RegisterInput & { confirmPassword?: string } =
      req.body;

    // Validate required fields
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
      return;
    }

    // Validate password confirmation if provided
    if (confirmPassword && password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
      return;
    }

    // Register user
    await registerUser({ name, email, password });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Registration failed";
    
    // Handle duplicate email error
    if (errorMessage.includes("Email already registered")) {
      res.status(409).json({ success: false, message: errorMessage });
      return;
    }
    
    res.status(500).json({ success: false, message: "Internal server error", error: errorMessage });
  }
};

/**
 * Login user
 * POST /api/auth/login
 * @body {string} email - User's email address
 * @body {string} password - User's password
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginInput = req.body;
    
    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and password are required" });
      return;
    }

    // Authenticate user
    const result = await loginUser({ email, password });

    // Set refresh token cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie("refreshToken", result.refreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Login failed";
    
    // Handle authentication errors
    if (errorMessage.includes("Account or password is incorrect")) {
      res.status(401).json({ success: false, message: "Account or password is incorrect" });
      return;
    }
    
    res.status(500).json({ success: false, message: "Internal server error", error: errorMessage });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 * @cookie {string} refreshToken - Refresh token from cookie
 * @body {string} refreshToken - Refresh token from body (fallback)
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    // Accept token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    if (!refreshToken) {
      res.status(400).json({ success: false, message: "Refresh token is required" });
      return;
    }

    // Generate new access token
    const result = await refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: { accessToken: result.accessToken },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Token refresh failed";
    
    // Handle token validation errors
    if (
      errorMessage.includes("Invalid") ||
      errorMessage.includes("expired") ||
      errorMessage.includes("revoked") ||
      errorMessage.includes("not found")
    ) {
      res.status(401).json({ success: false, message: errorMessage });
      return;
    }
    
    res.status(500).json({ success: false, message: "Internal server error", error: errorMessage });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 * @cookie {string} refreshToken - Refresh token from cookie
 * @body {string} refreshToken - Refresh token from body (fallback)
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // Accept token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    // Clear cookie even if no token present (idempotent operation)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };

    if (!refreshToken) {
      res.clearCookie("refreshToken", cookieOptions);
      res.status(200).json({ success: true, message: "Logout successful" });
      return;
    }

    // Revoke the token in database
    await logoutUser(refreshToken);

    // Clear cookie and respond
    res.clearCookie("refreshToken", cookieOptions);
    res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    // Clear cookie even on error (idempotent operation)
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    });
    
    const errorMessage = error instanceof Error ? error.message : "Logout failed";
    res.status(500).json({ success: false, message: errorMessage });
  }
};

/**
 * Get current user information
 * GET /api/auth/me
 * Requires authentication via JWT token
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract user from JWT token (set by auth middleware)
    const decoded = (req as any).user || (req as any).body?.user;

    let userRecord = null;

    // Find user by ID or email
    if (decoded?.id) {
      userRecord = await User.findByPk(decoded.id);
    } else if (decoded?.email) {
      userRecord = await User.findOne({ where: { email: decoded.email } });
    } else {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    if (!userRecord) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Return user information (excluding password)
    res.status(200).json({
      success: true,
      data: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        username: userRecord.username,
        avatarUrl: userRecord.avatar_url,
        createdAt: userRecord.createdAt,
        updatedAt: userRecord.updatedAt,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get user";
    res.status(500).json({ success: false, message: errorMessage });
  }
};
