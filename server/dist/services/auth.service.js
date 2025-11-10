/**
 * Authentication Service
 * Handles user authentication operations including registration, login, token management
 */
import User from "../models/user.model.js";
import RefreshToken from "../models/refresh-token.model.js";
import { hashPassword, comparePassword } from "../utils/hashPassword.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, } from "../utils/generateToken.js";
import { validateRegister, validateLogin, validateChangePassword } from "../utils/validateInput.js";
import { cacheAside, CACHE_TTL, deleteCache } from "./cache.service.js";
import { userByEmailKey, userByIdKey } from "../utils/cache-key.util.js";
/**
 * Register a new user
 * @param registerData - User registration data (name, email, password)
 * @throws Error if email already exists
 */
export const registerUser = async (registerData) => {
    // Validate and normalize input
    const { name, email, password } = validateRegister(registerData.name, registerData.email, registerData.password);
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        throw new Error("Email already registered");
    }
    // Hash password before storing
    const hashedPassword = await hashPassword(password);
    // Create new user
    await User.create({
        name,
        email,
        password: hashedPassword,
    });
};
/**
 * Login user and generate authentication tokens
 * @param loginData - User login credentials (email, password)
 * @returns User data, access token, and refresh token
 * @throws Error if credentials are invalid
 */
export const loginUser = async (loginData) => {
    const { email, password } = validateLogin(loginData.email, loginData.password);
    // Find user by email with cache
    const cacheKey = userByEmailKey(email);
    const user = await cacheAside(cacheKey, () => User.findByEmail(email), CACHE_TTL.USER);
    if (!user) {
        throw new Error("Account or password is incorrect");
    }
    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
        throw new Error("Account or password is incorrect");
    }
    // Generate authentication tokens
    const accessToken = generateAccessToken({ id: user.id, name: user.name, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, name: user.name, email: user.email });
    // Store refresh token in database with 7 days expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await RefreshToken.create({
        user_id: user.id,
        token: refreshToken,
        expires_at: expiresAt,
        is_revoked: false,
    });
    // Prepare user response (exclude password)
    const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username || null,
        bio: user.bio || null,
        avatarUrl: user.avatar_url || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
    return {
        user: userResponse,
        accessToken,
        refreshToken,
    };
};
/**
 * Refresh access token using refresh token
 * @param token - Refresh token
 * @returns New access token
 * @throws Error if token is invalid, expired, or revoked
 */
export const refreshAccessToken = async (token) => {
    // Verify refresh token signature
    const verificationResult = verifyRefreshToken(token);
    if (!verificationResult.valid) {
        throw new Error("Invalid or expired refresh token");
    }
    // Check if token exists in database and is valid
    const storedToken = await RefreshToken.findByToken(token);
    if (!storedToken) {
        throw new Error("Refresh token not found");
    }
    // Check if token is revoked
    if (storedToken.is_revoked) {
        throw new Error("Refresh token has been revoked");
    }
    // Check if token is expired
    if (storedToken.expires_at < new Date()) {
        throw new Error("Refresh token has expired");
    }
    // Get user information
    const user = await User.findByPk(storedToken.user_id);
    if (!user) {
        throw new Error("User not found");
    }
    // Generate new access token
    const newAccessToken = generateAccessToken({ id: user.id, name: user.name, email: user.email });
    return {
        accessToken: newAccessToken,
    };
};
/**
 * Logout user by revoking refresh token
 * @param token - Refresh token to revoke
 * @returns Success message
 */
export const logoutUser = async (token) => {
    // Find token in database
    const storedToken = await RefreshToken.findByToken(token);
    // If token not found or already revoked, treat as successful (idempotent)
    if (!storedToken || storedToken.is_revoked) {
        return { message: "Logout successful" };
    }
    // Revoke the token
    storedToken.is_revoked = true;
    await storedToken.save();
    return {
        message: "Logout successful",
    };
};
/**
 * Change user password
 * @param email - User's email
 * @param data - Current password and new password
 * @returns Success message
 * @throws Error if current password is incorrect
 */
export const changePassword = async (email, data) => {
    const { currentPassword, newPassword } = validateChangePassword(email, data.currentPassword, data.newPassword);
    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
        throw new Error("User not found");
    }
    // Verify current password
    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
        throw new Error("Current password is incorrect");
    }
    // Hash and save new password
    const hashed = await hashPassword(newPassword);
    user.password = hashed;
    await user.save();
    // Invalidate user cache
    await deleteCache(userByEmailKey(email));
    await deleteCache(userByIdKey(user.id));
    return { message: "Password changed successfully" };
};
