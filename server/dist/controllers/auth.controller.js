import { registerUser, loginUser, refreshAccessToken, logoutUser, } from "../services/auth.service.js";
import User from "../models/user.model.js";
import { clearCachedSuggestions } from "../services/new-chat-suggestions.service.js";
import { clearUserProfile } from "../services/memory.service.js";
import jwt from "jsonwebtoken";
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
export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        };
        if (!refreshToken) {
            res.clearCookie("refreshToken", cookieOptions);
            res.status(200).json({ success: true, message: "Logout successful" });
            return;
        }
        let userId = null;
        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || "refresh_secret");
            userId = decoded?.id || null;
        }
        catch (err) {
        }
        await logoutUser(refreshToken);
        if (userId) {
            try {
                await Promise.all([clearCachedSuggestions(userId), clearUserProfile(userId)]);
            }
            catch (cacheErr) {
            }
        }
        res.clearCookie("refreshToken", cookieOptions);
        res.status(200).json({ success: true, message: "Logout successful" });
    }
    catch (error) {
        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        });
        const errorMessage = error instanceof Error ? error.message : "Logout failed";
        res.status(500).json({ success: false, message: errorMessage });
    }
};
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
