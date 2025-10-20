import { Router } from "express";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
import { create, getAll, getOne, update, remove, generateTitle, } from "../controllers/conversation.controller.js";
import { getMessages, sendMessageStream } from "../controllers/message.controller.js";
import { semanticSearch } from "../controllers/semantic-search.controller.js";
const router = Router();
// All conversation routes require authentication
router.use(authenticateAccessToken);
/**
 * Conversation CRUD Routes
 */
// Generate a smart title for a conversation based on message content
// POST /api/conversations/generate-title
// Body: { content: string }
router.post("/generate-title", generateTitle);
// Create a new conversation
// POST /api/conversations
router.post("/", create);
// Get all conversations for authenticated user (with pagination)
// GET /api/conversations?page=1&limit=20
router.get("/", getAll);
// Get a specific conversation by ID
// GET /api/conversations/:id
router.get("/:id", getOne);
// Update a conversation (rename, change model, etc.)
// PATCH /api/conversations/:id
router.patch("/:id", update);
// Delete a conversation (soft delete)
// DELETE /api/conversations/:id
router.delete("/:id", remove);
/**
 * Message Routes (nested under conversations)
 */
// Get all messages for a conversation (with pagination)
// GET /api/conversations/:id/messages?page=1&limit=30
router.get("/:id/messages", getMessages);
// Send a user message and stream AI response via Server-Sent Events (SSE)
// POST /api/conversations/:id/messages/stream
router.post("/:id/messages/stream", sendMessageStream);
/**
 * Semantic Search Route
 */
// Semantic search within a conversation
// POST /api/conversations/:id/search
// Body: { query: string, limit?: number, similarity_threshold?: number }
router.post("/:id/search", semanticSearch);
export default router;
