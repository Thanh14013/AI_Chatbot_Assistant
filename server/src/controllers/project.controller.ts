/**
 * Project Controller
 * Handles HTTP requests for project management
 */

import { Request, Response } from "express";
import {
  getProjectsByUserId,
  createProject,
  updateProject,
  deleteProject,
  getProjectConversations,
  moveConversationToProject,
  updateConversationOrders,
} from "../services/project.service.js";
import { broadcastToUser } from "../services/socket.service.js";
import Conversation from "../models/conversation.model.js";

/**
 * Helper function to get user ID from authenticated request
 */
const getUserIdFromRequest = (req: Request): string | null => {
  // Access token is decoded and stored in req.body.user by authJwt middleware
  // Token payload structure: { id, name, email, type }
  const userId = req.body?.user?.id;
  return userId || null;
};

/**
 * Get all projects for authenticated user
 * GET /api/projects
 */
export const getProjects = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get projects";
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Create a new project
 * POST /api/projects
 * Body: { name, description?, color?, icon? }
 */
export const create = async (req: Request, res: Response): Promise<void> => {
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

    // Broadcast project creation to all user's sockets (realtime), excluding sender
    const socketId = req.headers["x-socket-id"] as string | undefined;
    broadcastToUser(userId, "project:created", project, socketId);

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create project";
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
    });
  }
};

/**
 * Update a project
 * PUT /api/projects/:id
 * Body: { name?, description?, color?, icon?, order? }
 */
export const update = async (req: Request, res: Response): Promise<void> => {
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

    // Broadcast project update to all user's sockets (realtime), excluding sender
    const socketId = req.headers["x-socket-id"] as string | undefined;
    broadcastToUser(userId, "project:updated", project, socketId);

    res.json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
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

/**
 * Delete a project (soft delete)
 * DELETE /api/projects/:id
 */
export const remove = async (req: Request, res: Response): Promise<void> => {
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

    // Broadcast project deletion to all user's sockets (realtime), excluding sender
    const socketId = req.headers["x-socket-id"] as string | undefined;
    broadcastToUser(userId, "project:deleted", { projectId: id }, socketId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
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

/**
 * Get all conversations in a project
 * GET /api/projects/:id/conversations
 */
export const getConversations = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
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

/**
 * Move a conversation to a project
 * PUT /api/conversations/:id/move
 * Body: { projectId: string | null }
 */
export const moveConversation = async (req: Request, res: Response): Promise<void> => {
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

    // Get old project ID before moving (for WebSocket broadcast)
    const conversation = await Conversation.findByIdActive(id);
    const oldProjectId = conversation?.project_id || null;

    const result = await moveConversationToProject(id, projectId, userId);

    // Broadcast conversation:moved event via WebSocket for multi-tab sync
    if (global.socketIO) {
      global.socketIO.emit("conversation:moved", {
        conversationId: id,
        oldProjectId,
        newProjectId: projectId,
        userId,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
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

/**
 * Update conversation orders within a project
 * PUT /api/projects/:id/conversations/order
 * Body: { orders: Array<{ conversationId: string, order: number }> }
 */
export const updateOrders = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
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
