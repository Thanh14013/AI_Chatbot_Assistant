/**
 * Health Check Routes
 * Provides endpoints for monitoring service health and readiness
 */

import express from "express";
import { isRedisConnected } from "../config/redis.config.js";
import sequelize from "../db/database.config.js";

const router = express.Router();

/**
 * Basic health check - returns 200 if service is running
 * Used by monitoring tools and load balancers
 */
router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Detailed readiness check - verifies all dependencies
 * Returns 200 only if all critical services (DB) are ready
 */
router.get("/ready", async (_req, res) => {
  const checks = {
    server: "ok",
    database: "unknown",
    redis: "unknown",
  };

  let allHealthy = true;

  // Check database connection
  try {
    await sequelize.authenticate();
    checks.database = "ok";
  } catch (error) {
    checks.database = "error";
    allHealthy = false;
  }

  // Check Redis connection (optional, don't fail if unavailable)
  if (isRedisConnected()) {
    checks.redis = "ok";
  } else {
    checks.redis = "disconnected";
    // Redis is optional for graceful degradation
  }

  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks,
    uptime: process.uptime(),
  });
});

export default router;
