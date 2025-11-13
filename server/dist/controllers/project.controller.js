import { getProjectsByUserId, createProject, updateProject, deleteProject, getProjectConversations, moveConversationToProject, updateConversationOrders, } from "../services/project.service.js";
import { broadcastToUser } from "../services/socket.service.js";
import Conversation from "../models/conversation.model.js";
const getUserIdFromRequest = (req) => {
    const userId = req.body?.user?.id;
    return userId || null;
};
export const getProjects = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const projects = await getProjectsByUserId(userId);
        res.status(200).json({
            success: true,
            message: "Projects retrieved successfully",
            data: projects,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get projects";
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const create = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { name, description, color, icon } = req.body;
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: "Project name is required",
            });
            return;
        }
        const project = await createProject({
            user_id: userId,
            name: name.trim(),
            description: description || null,
            color: color || "#1890ff",
            icon: icon || null,
        });
        const socketId = req.headers["x-socket-id"];
        broadcastToUser(userId, "project:created", project, socketId);
        res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: project,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create project";
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const update = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { id } = req.params;
        const { name, description, color, icon, order } = req.body;
        const project = await updateProject(id, userId, {
            name,
            description,
            color,
            icon,
            order,
        });
        const socketId = req.headers["x-socket-id"];
        broadcastToUser(userId, "project:updated", project, socketId);
        res.json({
            success: true,
            message: "Project updated successfully",
            data: project,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update project";
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
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { id } = req.params;
        const result = await deleteProject(id, userId);
        const socketId = req.headers["x-socket-id"];
        broadcastToUser(userId, "project:deleted", { projectId: id }, socketId);
        res.status(200).json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete project";
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
export const getConversations = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { id } = req.params;
        const conversations = await getProjectConversations(id, userId);
        res.status(200).json({
            success: true,
            message: "Conversations retrieved successfully",
            data: conversations,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get conversations";
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
export const moveConversation = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { id } = req.params;
        const { projectId } = req.body;
        const conversation = await Conversation.findByIdActive(id);
        const oldProjectId = conversation?.project_id || null;
        const result = await moveConversationToProject(id, projectId, userId);
        if (global.socketIO) {
            const senderSocketId = req.headers["x-socket-id"];
            if (senderSocketId) {
                const senderSocket = global.socketIO.sockets.sockets.get(senderSocketId);
                if (senderSocket) {
                    senderSocket.broadcast.emit("conversation:moved", {
                        conversationId: id,
                        oldProjectId,
                        newProjectId: projectId,
                        userId,
                    });
                }
                else {
                    global.socketIO.emit("conversation:moved", {
                        conversationId: id,
                        oldProjectId,
                        newProjectId: projectId,
                        userId,
                    });
                }
            }
            else {
                global.socketIO.emit("conversation:moved", {
                    conversationId: id,
                    oldProjectId,
                    newProjectId: projectId,
                    userId,
                });
            }
        }
        res.status(200).json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to move conversation";
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
export const updateOrders = async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { id } = req.params;
        const { orders } = req.body;
        if (!Array.isArray(orders)) {
            res.status(400).json({
                success: false,
                message: "Orders must be an array",
            });
            return;
        }
        const result = await updateConversationOrders(id, userId, orders);
        res.status(200).json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update orders";
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
