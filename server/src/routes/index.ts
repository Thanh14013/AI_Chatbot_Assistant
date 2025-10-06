import { Router } from "express";
import authRoutes from "./auth.route.js";
import conversationRoutes from "./conversation.route.js";

const router = Router();

// Authentication routes
router.use("/auth", authRoutes);

// Conversation and message routes
router.use("/conversations", conversationRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
