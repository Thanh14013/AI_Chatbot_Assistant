import { Router } from "express";
import authRoutes from "./auth.route.js";
import conversationRoutes from "./conversation.route.js";
import searchRoutes from "./search.route.js";
import userRoutes from "./user.route.js";
import fileUploadRoutes from "./fileUpload.routes.js";
import projectRoutes from "./project.routes.js";
const router = Router();
// Authentication routes
router.use("/auth", authRoutes);
// User routes
router.use("/users", userRoutes);
// Conversation and message routes
router.use("/conversations", conversationRoutes);
// Project routes
router.use("/projects", projectRoutes);
// Global search routes
router.use("/search", searchRoutes);
// File upload routes
router.use("/files", fileUploadRoutes);
// Health check route
router.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "API is running",
        timestamp: new Date().toISOString(),
    });
});
export default router;
