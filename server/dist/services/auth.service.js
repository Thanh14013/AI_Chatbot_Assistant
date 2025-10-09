import User from "../models/user.model.js";
import RefreshToken from "../models/refresh-token.model.js";
import { hashPassword, comparePassword } from "../utils/hashPassword.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, } from "../utils/generateToken.js";
import { validateRegister, validateLogin, validateChangePassword } from "../utils/validateInput.js";
//Register a new user
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
    const user = await User.create({
        name,
        email,
        password: hashedPassword,
    });
    return;
};
// Login user
export const loginUser = async (loginData) => {
    const { email, password } = validateLogin(loginData.email, loginData.password);
    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
        // Standardized error message for wrong credentials
        throw new Error("Account or password is incorrect");
    }
    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
        // Standardized error message for wrong credentials
        throw new Error("Account or password is incorrect");
    }
    // Generate new tokens
    const accessToken = generateAccessToken({ name: user.name, email: user.email });
    const refreshToken = generateRefreshToken({ name: user.name, email: user.email });
    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration
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
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
    return {
        user: userResponse,
        accessToken,
        refreshToken,
    };
};
// Refresh access token using refresh token
export const refreshAccessToken = async (token) => {
    // Verify refresh token
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
    // Generate new access token only
    const newAccessToken = generateAccessToken({ name: user.name, email: user.email });
    return {
        accessToken: newAccessToken,
    };
};
// Logout user by revoking the specific refresh token
export const logoutUser = async (token) => {
    // Find token in database to identify the user
    const storedToken = await RefreshToken.findByToken(token);
    if (!storedToken) {
        throw new Error("Refresh token not found");
    }
    // Check if token is already revoked
    if (storedToken.is_revoked) {
        throw new Error("Refresh token already revoked");
    }
    // Revoke only this specific token (logout from current device)
    storedToken.is_revoked = true;
    await storedToken.save();
    return {
        message: "Logout successful",
    };
};
// Change password for a user (identified by email)
export const changePassword = async (email, data) => {
    const { currentPassword, newPassword } = validateChangePassword(email, data.currentPassword, data.newPassword);
    // Find user
    const user = await User.findByEmail(email);
    if (!user)
        throw new Error("User not found");
    // Verify current password
    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid)
        throw new Error("Current password is incorrect");
    // Hash new password and save
    const hashed = await hashPassword(newPassword);
    user.password = hashed;
    await user.save();
    return { message: "Password changed successfully" };
};
