import { getUserProfile, updateUserProfile, updateUserAvatar, removeUserAvatar, changeUserPassword, } from "../services/user-profile.service.js";
export const getProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const profile = await getUserProfile(userId);
        res.status(200).json({
            success: true,
            data: profile,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to fetch profile",
        });
    }
};
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const updates = req.body;
        if (updates.username !== undefined && updates.username !== null) {
            if (updates.username.length < 3 || updates.username.length > 50) {
                res.status(400).json({
                    success: false,
                    message: "Username must be between 3 and 50 characters",
                });
                return;
            }
        }
        if (updates.bio !== undefined && updates.bio !== null && updates.bio.length > 200) {
            res.status(400).json({
                success: false,
                message: "Bio must not exceed 200 characters",
            });
            return;
        }
        const updatedProfile = await updateUserProfile(userId, updates);
        res.status(200).json({
            success: true,
            data: updatedProfile,
            message: "Profile updated successfully",
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === "Username already taken") {
            res.status(409).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to update profile",
        });
    }
};
export const uploadAvatarHandler = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "No file uploaded",
            });
            return;
        }
        const result = await updateUserAvatar(userId, req.file.buffer);
        res.status(200).json({
            success: true,
            data: result,
            message: "Avatar uploaded successfully",
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to upload avatar",
        });
    }
};
export const removeAvatarHandler = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        await removeUserAvatar(userId);
        res.status(200).json({
            success: true,
            message: "Avatar removed successfully",
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === "No avatar to remove") {
            res.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to remove avatar",
        });
    }
};
export const changePassword = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const { currentPassword, newPassword, confirmNewPassword, } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({
                success: false,
                message: "Current password and new password are required",
            });
            return;
        }
        if (confirmNewPassword && newPassword !== confirmNewPassword) {
            res.status(400).json({
                success: false,
                message: "Passwords do not match",
            });
            return;
        }
        await changeUserPassword(userId, { currentPassword, newPassword });
        res.status(200).json({
            success: true,
            message: "Password changed successfully",
        });
    }
    catch (error) {
        if (error instanceof Error) {
            if (error.message === "Current password is incorrect") {
                res.status(401).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            if (error.message.includes("Password must") ||
                error.message === "New password must be different from current password") {
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to change password",
        });
    }
};
export default {
    getProfile,
    updateProfile,
    uploadAvatarHandler,
    removeAvatarHandler,
    changePassword,
};
