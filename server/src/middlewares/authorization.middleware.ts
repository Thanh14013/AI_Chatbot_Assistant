/**
 * Authorization Middleware
 * Verify user access to resources
 */

import { Request, Response, NextFunction } from "express";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import Project from "../models/project.model.js";

/**
 * Get user ID from authenticated request
 */
const getUserIdFromRequest = async (req: Request): Promise<string | null> => {
  const userEmail = (req as any).user?.email;
  if (!userEmail) return null;

  const user = await User.findByEmail(userEmail);
  return user ? user.id : null;
};

/**
 * Verify user has access to conversation
 * Middleware to check conversation ownership
 */
export const verifyConversationAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    // Check if conversation exists and belongs to user
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

    // Attach conversation to request for later use
    (req as any).conversation = conversation;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to verify conversation access",
    });
  }
};

/**
 * Verify user has access to project
 * Middleware to check project ownership
 */
export const verifyProjectAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    // Check if project exists and belongs to user
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

    // Attach project to request for later use
    (req as any).project = project;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to verify project access",
    });
  }
};

/**
 * Verify user has access to file
 * Middleware to check file ownership through conversation
 */
export const verifyFileAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    // Import FileUploadModel dynamically to avoid circular dependency
    const FileUploadModel = (await import("../models/fileUpload.model.js")).default;

    // Get file by public_id (files use string IDs, not numbers)
    const file = await FileUploadModel.findByPublicId(fileId);
    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    // Check if user owns the file (through conversation ownership)
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
    // Note: Files without conversation_id are allowed (uploaded but not yet attached)

    // Attach file to request for later use
    (req as any).file = file;
    next();
  } catch (error) {
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
