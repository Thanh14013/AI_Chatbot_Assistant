import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import { uploadAvatar, deleteAvatar } from "./cloudinary.service.js";
import { deleteCache } from "./cache.service.js";
import { userByIdKey, userByEmailKey } from "../utils/cache-key.util.js";
export const getUserProfile = async (userId) => {
    const user = await User.findByPk(userId, {
        attributes: { exclude: ["password"] },
    });
    if (!user) {
        throw new Error("User not found");
    }
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username || null,
        bio: user.bio || null,
        avatar_url: user.avatar_url || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};
export const updateUserProfile = async (userId, updates) => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new Error("User not found");
    }
    if (updates.username && updates.username !== user.username) {
        const existingUser = await User.findByUsername(updates.username);
        if (existingUser && existingUser.id !== userId) {
            throw new Error("Username already taken");
        }
    }
    if (updates.bio !== undefined) {
        updates.bio = sanitizeBio(updates.bio);
    }
    await user.update(updates);
    await deleteCache(userByIdKey(user.id));
    await deleteCache(userByEmailKey(user.email));
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username || null,
        bio: user.bio || null,
        avatar_url: user.avatar_url || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};
export const updateUserAvatar = async (userId, fileBuffer) => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new Error("User not found");
    }
    if (user.avatar_url) {
        try {
            await deleteAvatar(user.avatar_url);
        }
        catch (error) {
        }
    }
    const avatarUrl = await uploadAvatar(fileBuffer, userId);
    await user.update({ avatar_url: avatarUrl });
    await deleteCache(userByIdKey(user.id));
    await deleteCache(userByEmailKey(user.email));
    return { avatar_url: avatarUrl };
};
export const removeUserAvatar = async (userId) => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new Error("User not found");
    }
    if (!user.avatar_url) {
        throw new Error("No avatar to remove");
    }
    try {
        await deleteAvatar(user.avatar_url);
    }
    catch (error) {
    }
    await user.update({ avatar_url: null });
    await deleteCache(userByIdKey(user.id));
    await deleteCache(userByEmailKey(user.email));
};
export const changeUserPassword = async (userId, data) => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new Error("User not found");
    }
    const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
        throw new Error("Current password is incorrect");
    }
    validatePasswordStrength(data.newPassword);
    const isSameAsCurrentPassword = await bcrypt.compare(data.newPassword, user.password);
    if (isSameAsCurrentPassword) {
        throw new Error("New password must be different from current password");
    }
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await user.update({ password: hashedPassword });
    await deleteCache(userByIdKey(user.id));
    await deleteCache(userByEmailKey(user.email));
};
const validatePasswordStrength = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (password.length < minLength) {
        throw new Error(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
        throw new Error("Password must contain at least one uppercase letter");
    }
    if (!hasLowerCase) {
        throw new Error("Password must contain at least one lowercase letter");
    }
    if (!hasNumber) {
        throw new Error("Password must contain at least one number");
    }
};
const sanitizeBio = (bio) => {
    if (!bio)
        return null;
    let sanitized = bio.replace(/<[^>]*>/g, "");
    sanitized = sanitized.trim();
    return sanitized || null;
};
export default {
    getUserProfile,
    updateUserProfile,
    updateUserAvatar,
    removeUserAvatar,
    changeUserPassword,
};
