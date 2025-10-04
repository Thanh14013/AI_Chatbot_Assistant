import { Router } from "express";
import authRoutes from "./auth.route.js";

const router = Router();

// Authentication routes
router.use("/auth", authRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
