import { getUserPreferences, updateUserPreferences } from "../services/user-preference.service.js";
export const getPreferences = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const preferences = await getUserPreferences(userId);
        res.status(200).json({
            success: true,
            data: preferences,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch preferences";
        res.status(500).json({
            success: false,
            message: errorMessage,
        });
    }
};
export const updatePreferences = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const updates = req.body;
        if (!updates.language && !updates.response_style && updates.custom_instructions === undefined) {
            res.status(400).json({
                success: false,
                message: "At least one preference field must be provided",
            });
            return;
        }
        const preferences = await updateUserPreferences(userId, updates);
        res.status(200).json({
            success: true,
            message: "Preferences updated successfully",
            data: preferences,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update preferences";
        if (errorMessage.includes("Invalid") ||
            errorMessage.includes("exceed") ||
            errorMessage.includes("Supported")) {
            res.status(400).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: errorMessage,
        });
    }
};
