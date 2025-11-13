import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import Project from "../models/project.model.js";
const getUserIdFromRequest = async (req) => {
    const userEmail = req.user?.email;
    if (!userEmail)
        return null;
    const user = await User.findByEmail(userEmail);
    return user ? user.id : null;
};
export const verifyConversationAccess = async (req, res, next) => {
    try {
        const conversationId = req.params.id || req.params.conversationId;
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        if (!conversationId) {
            res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
            return;
        }
        const conversation = await Conversation.findOne({
            where: {
                id: conversationId,
                user_id: userId,
                deleted_at: null,
            },
        });
        if (!conversation) {
            res.status(403).json({
                success: false,
                message: "Access denied. Conversation not found or you don't have permission.",
            });
            return;
        }
        req.conversation = conversation;
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to verify conversation access",
        });
    }
};
export const verifyProjectAccess = async (req, res, next) => {
    try {
        const projectId = req.params.id || req.params.projectId;
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        if (!projectId) {
            res.status(400).json({
                success: false,
                message: "Project ID is required",
            });
            return;
        }
        const project = await Project.findOne({
            where: {
                id: projectId,
                user_id: userId,
                deleted_at: null,
            },
        });
        if (!project) {
            res.status(403).json({
                success: false,
                message: "Access denied. Project not found or you don't have permission.",
            });
            return;
        }
        req.project = project;
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to verify project access",
        });
    }
};
export const verifyFileAccess = async (req, res, next) => {
    try {
        const fileId = req.params.id || req.params.fileId;
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        if (!fileId) {
            res.status(400).json({
                success: false,
                message: "File ID is required",
            });
            return;
        }
        const FileUploadModel = (await import("../models/fileUpload.model.js")).default;
        const file = await FileUploadModel.findByPublicId(fileId);
        if (!file) {
            res.status(404).json({
                success: false,
                message: "File not found",
            });
            return;
        }
        if (file.conversation_id) {
            const conversation = await Conversation.findOne({
                where: {
                    id: file.conversation_id,
                    user_id: userId,
                    deleted_at: null,
                },
            });
            if (!conversation) {
                res.status(403).json({
                    success: false,
                    message: "Access denied. You don't have permission to access this file.",
                });
                return;
            }
        }
        req.file = file;
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to verify file access",
        });
    }
};
export default {
    verifyConversationAccess,
    verifyProjectAccess,
    verifyFileAccess,
};
