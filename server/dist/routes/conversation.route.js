import { Router } from "express";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
import { verifyConversationAccess } from "../middlewares/authorization.middleware.js";
import { create, getAll, getOne, update, remove, generateTitle, getPopularTagsController, } from "../controllers/conversation.controller.js";
import { getMessages, sendMessageStream } from "../controllers/message.controller.js";
import { pinMessage, unpinMessage, getPinnedMessages, } from "../controllers/message-pin.controller.js";
import { semanticSearch } from "../controllers/semantic-search.controller.js";
const router = Router();
router.use(authenticateAccessToken);
router.post("/generate-title", generateTitle);
router.get("/tags/popular", getPopularTagsController);
router.post("/", create);
router.get("/", getAll);
router.get("/:id", verifyConversationAccess, getOne);
router.patch("/:id", verifyConversationAccess, update);
router.delete("/:id", verifyConversationAccess, remove);
router.put("/:id/move", async (req, res) => {
    try {
        const { moveConversation } = await import("../controllers/project.controller.js");
        return moveConversation(req, res);
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Failed to move conversation" });
    }
});
router.get("/:id/messages", verifyConversationAccess, getMessages);
router.get("/:id/messages/pinned", verifyConversationAccess, getPinnedMessages);
router.post("/:id/messages/stream", verifyConversationAccess, sendMessageStream);
router.patch("/messages/:messageId/pin", pinMessage);
router.patch("/messages/:messageId/unpin", unpinMessage);
router.post("/:id/search", verifyConversationAccess, semanticSearch);
export default router;
