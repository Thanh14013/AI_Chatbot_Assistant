import { registerUser, loginUser, refreshAccessToken, logoutUser, } from "../services/auth.service.js";
import User from "../models/user.model.js";
/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({
                success: false,
                message: "Name, email, and password are required",
            });
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({
                success: false,
                message: "Invalid email format",
            });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long",
            });
            return;
        }
        if (confirmPassword && password !== confirmPassword) {
            res.status(400).json({
                success: false,
                message: "Passwords do not match",
            });
            return;
        }
        await registerUser({ name, email, password });
        res.status(201).json({
            success: true,
            message: "User registered successfully",
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Registration failed";
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
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: "Email and password are required" });
            return;
        }
        const result = await loginUser({ email, password });
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Login failed";
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
 */
export const refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!refreshToken) {
            res.status(400).json({ success: false, message: "Refresh token is required" });
            return;
        }
        const result = await refreshAccessToken(refreshToken);
        res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            data: { accessToken: result.accessToken },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Token refresh failed";
        if (errorMessage.includes("Invalid") ||
            errorMessage.includes("expired") ||
            errorMessage.includes("revoked") ||
            errorMessage.includes("not found")) {
            res.status(401).json({ success: false, message: errorMessage });
            return;
        }
        res.status(500).json({ success: false, message: "Internal server error", error: errorMessage });
    }
};
/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
    try {
        // Accept refresh token from cookie or request body (body fallback helps debugging and some clients)
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!refreshToken) {
            // No token present. Still clear cookie and return success (idempotent),
            // but don't treat this as a failure — caller may have already cleared it client-side.
            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
            });
            res.status(200).json({ success: true, message: "Logout successful" });
            return;
        }
        // Attempt to revoke the token in DB. If it doesn't exist the service will throw;
        // we catch below and still clear cookie to keep behavior idempotent.
        await logoutUser(refreshToken);
        // Clear cookie and respond
        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        });
        // logout success log suppressed
        res.status(200).json({ success: true, message: "Logout successful" });
    }
    catch (error) {
        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        });
        // Error logging suppressed in server output
        const errorMessage = error instanceof Error ? error.message : "Logout failed";
        // In development, include the message to help debugging; in production keep generic
        res.status(500).json({ success: false, message: errorMessage });
    }
};
/**
 * Get current user
 * GET /api/auth/me
 */
export const getCurrentUser = async (req, res) => {
    try {
        const decoded = req.user || req.body?.user;
        let userRecord = null;
        if (decoded?.id) {
            userRecord = await User.findByPk(decoded.id);
        }
        else if (decoded?.email) {
            userRecord = await User.findOne({ where: { email: decoded.email } });
        }
        else {
            res.status(401).json({ success: false, message: "User not authenticated" });
            return;
        }
        if (!userRecord) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get user";
        res.status(500).json({ success: false, message: errorMessage });
    }
};
