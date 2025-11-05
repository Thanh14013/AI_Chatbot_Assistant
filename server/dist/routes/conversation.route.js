import { Router } from "express";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
import { verifyConversationAccess } from "../middlewares/authorization.middleware.js";
import { create, getAll, getOne, update, remove, generateTitle, getPopularTagsController, } from "../controllers/conversation.controller.js";
import { getMessages, sendMessageStream } from "../controllers/message.controller.js";
import { pinMessage, unpinMessage, getPinnedMessages, } from "../controllers/message-pin.controller.js";
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
// Get popular tags for user
// GET /api/conversations/tags/popular
router.get("/tags/popular", getPopularTagsController);
// Create a new conversation
// POST /api/conversations
router.post("/", create);
// Get all conversations for authenticated user (with pagination)
// GET /api/conversations?page=1&limit=20&tags=work,urgent&tagMode=any
router.get("/", getAll);
// Get a specific conversation by ID
// GET /api/conversations/:id
router.get("/:id", verifyConversationAccess, getOne);
// Update a conversation (rename, change model, etc.)
// PATCH /api/conversations/:id
router.patch("/:id", verifyConversationAccess, update);
// Delete a conversation (soft delete)
// DELETE /api/conversations/:id
router.delete("/:id", verifyConversationAccess, remove);
// Move a conversation to a project (or remove from project)
// PUT /api/conversations/:id/move
// Body: { projectId: string | null }
router.put("/:id/move", async (req, res) => {
    try {
        // Import moveConversation from project controller
        const { moveConversation } = await import("../controllers/project.controller.js");
        return moveConversation(req, res);
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Failed to move conversation" });
    }
});
/**
 * Message Routes (nested under conversations)
 */
// Get all messages for a conversation (with pagination)
// GET /api/conversations/:id/messages?page=1&limit=30
router.get("/:id/messages", verifyConversationAccess, getMessages);
// Get all pinned messages for a conversation
// GET /api/conversations/:id/messages/pinned
router.get("/:id/messages/pinned", verifyConversationAccess, getPinnedMessages);
// Send a user message and stream AI response via Server-Sent Events (SSE)
// POST /api/conversations/:id/messages/stream
router.post("/:id/messages/stream", verifyConversationAccess, sendMessageStream);
/**
 * Message Pin/Unpin Routes
 */
// Pin a message
// PATCH /api/messages/:messageId/pin
router.patch("/messages/:messageId/pin", pinMessage);
// Unpin a message
// PATCH /api/messages/:messageId/unpin
router.patch("/messages/:messageId/unpin", unpinMessage);
/**
 * Semantic Search Route
 */
// Semantic search within a conversation
// POST /api/conversations/:id/search
// Body: { query: string, limit?: number, similarity_threshold?: number }
router.post("/:id/search", verifyConversationAccess, semanticSearch);
export default router;
