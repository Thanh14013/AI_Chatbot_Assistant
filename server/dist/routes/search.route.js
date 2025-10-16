import { Router } from "express";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
import { globalSearch, conversationSearchWithContext, } from "../controllers/global-search.controller.js";
const router = Router();
// All search routes require authentication
router.use(authenticateAccessToken);
/**
 * Global Search Routes
 */
// Search across all user's conversations
// POST /api/search/all
// Body: { query: string, limit?: number, messagesPerConversation?: number, similarity_threshold?: number }
router.post("/all", globalSearch);
// Search within a specific conversation with context
// POST /api/search/conversation/:id
// Body: { query: string, limit?: number, contextMessages?: number }
router.post("/conversation/:id", conversationSearchWithContext);
export default router;
