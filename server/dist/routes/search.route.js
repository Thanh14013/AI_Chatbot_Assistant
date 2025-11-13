import { Router } from "express";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
import { globalSearch, conversationSearchWithContext, } from "../controllers/global-search.controller.js";
const router = Router();
router.use(authenticateAccessToken);
router.post("/all", globalSearch);
router.post("/conversation/:id", conversationSearchWithContext);
export default router;
