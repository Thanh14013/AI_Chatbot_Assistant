import User from "../models/user.model.js";
import RefreshToken from "../models/refresh-token.model.js";
import { hashPassword, comparePassword } from "../utils/hashPassword.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, } from "../utils/generateToken.js";
import { validateRegister, validateLogin, validateChangePassword } from "../utils/validateInput.js";
import { cacheAside, CACHE_TTL, deleteCache } from "./cache.service.js";
import { userByEmailKey, userByIdKey } from "../utils/cache-key.util.js";
export const registerUser = async (registerData) => {
    const { name, email, password } = validateRegister(registerData.name, registerData.email, registerData.password);
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        throw new Error("Email already registered");
    }
    const hashedPassword = await hashPassword(password);
    await User.create({
        name,
        email,
        password: hashedPassword,
    });
};
export const loginUser = async (loginData) => {
    const { email, password } = validateLogin(loginData.email, loginData.password);
    const cacheKey = userByEmailKey(email);
    const user = await cacheAside(cacheKey, () => User.findByEmail(email), CACHE_TTL.USER);
    if (!user) {
        throw new Error("Account or password is incorrect");
    }
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
        throw new Error("Account or password is incorrect");
    }
    const accessToken = generateAccessToken({ id: user.id, name: user.name, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, name: user.name, email: user.email });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await RefreshToken.create({
        user_id: user.id,
        token: refreshToken,
        expires_at: expiresAt,
        is_revoked: false,
    });
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
export const refreshAccessToken = async (token) => {
    const verificationResult = verifyRefreshToken(token);
    if (!verificationResult.valid) {
        throw new Error("Invalid or expired refresh token");
    }
    const storedToken = await RefreshToken.findByToken(token);
    if (!storedToken) {
        throw new Error("Refresh token not found");
    }
    if (storedToken.is_revoked) {
        throw new Error("Refresh token has been revoked");
    }
    if (storedToken.expires_at < new Date()) {
        throw new Error("Refresh token has expired");
    }
    const user = await User.findByPk(storedToken.user_id);
    if (!user) {
        throw new Error("User not found");
    }
    const newAccessToken = generateAccessToken({ id: user.id, name: user.name, email: user.email });
    return {
        accessToken: newAccessToken,
    };
};
export const logoutUser = async (token) => {
    const storedToken = await RefreshToken.findByToken(token);
    if (!storedToken || storedToken.is_revoked) {
        return { message: "Logout successful" };
    }
    storedToken.is_revoked = true;
    await storedToken.save();
    return {
        message: "Logout successful",
    };
};
export const changePassword = async (email, data) => {
    const { currentPassword, newPassword } = validateChangePassword(email, data.currentPassword, data.newPassword);
    const user = await User.findByEmail(email);
    if (!user) {
        throw new Error("User not found");
    }
    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
        throw new Error("Current password is incorrect");
    }
    const hashed = await hashPassword(newPassword);
    user.password = hashed;
    await user.save();
    await deleteCache(userByEmailKey(email));
    await deleteCache(userByIdKey(user.id));
    return { message: "Password changed successfully" };
};
