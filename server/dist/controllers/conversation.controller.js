import { createConversation, getUserConversations, getConversationById, updateConversation, deleteConversation, generateConversationTitle, getPopularTags, } from "../services/conversation.service.js";
import User from "../models/user.model.js";
import { validateAndNormalizeTags } from "../utils/tag.util.js";
import { broadcastToUser } from "../services/socket.service.js";
const getUserIdFromRequest = async (req) => {
    const userEmail = req.body?.user?.email;
    if (!userEmail)
        return null;
    const user = await User.findByEmail(userEmail);
    return user ? user.id : null;
};
export const create = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { title, model, context_window, tags, project_id } = req.body;
        if (!title || title.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: "Conversation title is required",
            });
            return;
        }
        let validatedTags = undefined;
        if (tags !== undefined) {
            const tagValidation = validateAndNormalizeTags(tags);
            if (!tagValidation.isValid) {
                res.status(400).json({
                    success: false,
                    message: "Invalid tags",
                    errors: tagValidation.errors,
                });
                return;
            }
            validatedTags = tagValidation.normalizedTags;
        }
        const conversationData = {
            user_id: userId,
            title: title.trim(),
            model: model || "gpt-5-nano",
            context_window: context_window || 10,
            tags: validatedTags || [],
            ...(project_id && { project_id }),
        };
        const conversation = await createConversation(conversationData);
        const socketId = req.headers["x-socket-id"];
        broadcastToUser(userId, "conversation:created", conversation, socketId);
        res.status(201).json({
            success: true,
            message: "Conversation created successfully",
            data: conversation,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create conversation";
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const getAll = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        page = Math.max(1, page);
        limit = Math.max(1, Math.min(100, limit));
        const standaloneParam = req.query.standalone;
        const standalone = standaloneParam === "true" ? true : standaloneParam === "false" ? false : undefined;
        const tagsParam = req.query.tags;
        const tagMode = req.query.tagMode || "any";
        const tags = tagsParam
            ? tagsParam
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : undefined;
        if (tagMode !== "any" && tagMode !== "all") {
            res.status(400).json({
                success: false,
                message: "Invalid tagMode. Must be 'any' or 'all'",
            });
            return;
        }
        const result = await getUserConversations(userId, page, limit, search, tags, tagMode, standalone);
        res.status(200).json({
            success: true,
            message: "Conversations retrieved successfully",
            data: result.conversations,
            pagination: result.pagination,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get conversations";
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const getOne = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const conversationId = req.params.id;
        if (!conversationId) {
            res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
            return;
        }
        const conversation = await getConversationById(conversationId, userId);
        res.status(200).json({
            success: true,
            message: "Conversation retrieved successfully",
            data: conversation,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get conversation";
        if (errorMessage.includes("not found")) {
            res.status(404).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        if (errorMessage.includes("Unauthorized")) {
            res.status(403).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const update = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const conversationId = req.params.id;
        if (!conversationId) {
            res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
            return;
        }
        const { title, model, context_window, tags } = req.body;
        if (title === undefined &&
            model === undefined &&
            context_window === undefined &&
            tags === undefined) {
            res.status(400).json({
                success: false,
                message: "At least one field to update is required",
            });
            return;
        }
        let validatedTags = undefined;
        if (tags !== undefined) {
            const tagValidation = validateAndNormalizeTags(tags);
            if (!tagValidation.isValid) {
                res.status(400).json({
                    success: false,
                    message: "Invalid tags",
                    errors: tagValidation.errors,
                });
                return;
            }
            validatedTags = tagValidation.normalizedTags;
        }
        const updateData = {};
        if (title !== undefined)
            updateData.title = title.trim();
        if (model !== undefined)
            updateData.model = model;
        if (context_window !== undefined)
            updateData.context_window = context_window;
        if (validatedTags !== undefined)
            updateData.tags = validatedTags;
        const conversation = await updateConversation(conversationId, userId, updateData);
        const socketId = req.headers["x-socket-id"];
        broadcastToUser(userId, "conversation:updated", {
            conversationId,
            conversation,
        }, socketId);
        res.status(200).json({
            success: true,
            message: "Conversation updated successfully",
            data: conversation,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update conversation";
        if (errorMessage.includes("not found")) {
            res.status(404).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        if (errorMessage.includes("Unauthorized")) {
            res.status(403).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const remove = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const conversationId = req.params.id;
        if (!conversationId) {
            res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
            return;
        }
        const result = await deleteConversation(conversationId, userId);
        const socketId = req.headers["x-socket-id"];
        broadcastToUser(userId, "conversation:deleted", {
            conversationId,
        }, socketId);
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 20;
        page = Math.max(1, page);
        limit = Math.max(1, Math.min(100, limit));
        const conversationsResult = await getUserConversations(userId, page, limit);
        res.status(200).json({
            success: true,
            message: result.message,
            data: conversationsResult.conversations,
            pagination: conversationsResult.pagination,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete conversation";
        if (errorMessage.includes("not found")) {
            res.status(404).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        if (errorMessage.includes("Unauthorized")) {
            res.status(403).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const generateTitle = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { content } = req.body;
        if (!content || typeof content !== "string" || content.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: "Message content is required",
            });
            return;
        }
        const title = await generateConversationTitle(content.trim(), "");
        res.status(200).json({
            success: true,
            message: "Title generated successfully",
            data: { title },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to generate title";
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const getPopularTagsController = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const tags = await getPopularTags(userId);
        res.status(200).json({
            success: true,
            message: "Popular tags retrieved successfully",
            data: { tags },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get popular tags";
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
