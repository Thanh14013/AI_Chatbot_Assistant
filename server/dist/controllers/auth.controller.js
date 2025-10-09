import { registerUser, loginUser, refreshAccessToken, logoutUser, } from "../services/auth.service.js";
/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req, res) => {
    try {
        // Extract registration data from request body
        const { name, email, password, confirmPassword } = req.body;
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
        // Validate password confirmation (if provided)
        if (confirmPassword && password !== confirmPassword) {
            res.status(400).json({
                success: false,
                message: "Passwords do not match",
            });
            return;
        }
        // Call service to register user
        await registerUser({ name, email, password });
        // Send success response
        res.status(201).json({
            success: true,
            message: "User registered successfully",
        });
    }
    catch (error) {
        // Handle errors
        const errorMessage = error instanceof Error ? error.message : "Registration failed";
        // Check for specific error types
        if (errorMessage.includes("Email already registered")) {
            res.status(409).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        // Generic server error
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res) => {
    try {
        // Extract login credentials from request body
        const { email, password } = req.body;
        // Validate required fields
        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
            return;
        }
        // Call service to login user
        const result = await loginUser({ email, password });
        // Set refresh token in HttpOnly cookie
        // Cookie options: HttpOnly, Secure in production, SameSite lax
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        };
        res.cookie("refreshToken", result.refreshToken, cookieOptions);
        // Send success response without refresh token in body
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
        // Handle errors
        const errorMessage = error instanceof Error ? error.message : "Login failed";
        // Check for specific error types (credential errors)
        if (errorMessage.includes("Account or password is incorrect")) {
            // Return a standardized English message for wrong credentials
            res.status(401).json({
                success: false,
                message: "Account or password is incorrect",
            });
            return;
        }
        // Generic server error
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refresh = async (req, res) => {
    try {
        // Extract refresh token from cookie or request body
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        // Validate refresh token presence
        if (!refreshToken) {
            res.status(400).json({
                success: false,
                message: "Refresh token is required",
            });
            return;
        }
        // Call service to refresh token (returns only accessToken)
        const result = await refreshAccessToken(refreshToken);
        // Send success response with the new access token only
        res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            data: {
                accessToken: result.accessToken,
            },
        });
    }
    catch (error) {
        // Handle errors
        const errorMessage = error instanceof Error ? error.message : "Token refresh failed";
        // Check for specific error types
        if (errorMessage.includes("Invalid") ||
            errorMessage.includes("expired") ||
            errorMessage.includes("revoked") ||
            errorMessage.includes("not found")) {
            res.status(401).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        // Generic server error
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
    try {
        // Prefer refresh token from cookie; fall back to body
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        // If no token provided, still attempt to clear cookies but inform client
        if (!refreshToken) {
            // Clear refresh token cookie if present (use same path & secure flag as when set)
            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
            });
            res.status(200).json({
                success: true,
                message: "Logout successful",
            });
            return;
        }
        // Call service to logout user (revoke tokens in DB)
        const result = await logoutUser(refreshToken);
        // Clear refresh token cookie (use same path & secure flag as when set)
        const cookieClearOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        };
        res.clearCookie("refreshToken", cookieClearOptions);
        // Some browsers/proxies ignore clearCookie in certain cross-origin/proxy setups.
        // Also explicitly expire the cookie by setting it with an immediate past expiry.
        res.cookie("refreshToken", "", { ...cookieClearOptions, expires: new Date(0) });
        // Debug log for server-side confirmation
        console.debug("Cleared refreshToken cookie for logout (cookieClearOptions):", cookieClearOptions);
        // Send success response
        res.status(200).json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        // Handle errors
        const errorMessage = error instanceof Error ? error.message : "Logout failed";
        // Check for specific error types
        if (errorMessage.includes("not found") || errorMessage.includes("already revoked")) {
            res.status(404).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        // Generic server error
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
