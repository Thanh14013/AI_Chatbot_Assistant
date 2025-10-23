/**
 * Project Routes
 * API endpoints for project management
 */

import { Router } from "express";
import {
  getProjects,
  create,
  update,
  remove,
  getConversations,
  moveConversation,
  updateOrders,
} from "../controllers/project.controller.js";
import { authenticateAccessToken } from "../middlewares/authJwt.js";

const router = Router();

// All project routes require authentication
router.use(authenticateAccessToken);

/**
 * GET /api/projects
 * Get all projects for authenticated user
 */
router.get("/", getProjects);

/**
 * POST /api/projects
 * Create a new project
 * Body: { name, description?, color?, icon? }
 */
router.post("/", create);

/**
 * PUT /api/projects/:id
 * Update a project
 * Body: { name?, description?, color?, icon?, order? }
 */
router.put("/:id", update);

/**
 * DELETE /api/projects/:id
 * Delete a project (soft delete)
 */
router.delete("/:id", remove);

/**
 * GET /api/projects/:id/conversations
 * Get all conversations in a project
 */
router.get("/:id/conversations", getConversations);

/**
 * PUT /api/projects/:id/conversations/order
 * Update conversation orders within a project
 * Body: { orders: Array<{ conversationId: string, order: number }> }
 */
router.put("/:id/conversations/order", updateOrders);

export default router;
