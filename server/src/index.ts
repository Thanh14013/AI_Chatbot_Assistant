/**
 * Main Server Entry Point
 * Initializes Express server with all necessary middleware and configurations
 */

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import { createServer } from "http";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Import configurations
import { PORT as PORT_CONFIG, TIMEOUTS, RATE_LIMITING } from "./config/constants.js";
import { isRedisConnected } from "./config/redis.config.js";
import { logInfo, logError, logWarn } from "./utils/logger.util.js";

// Import core services
import connectToDatabase from "./db/database.connection.js";
import routes from "./routes/index.js";
import { securityStack } from "./middlewares/generalMiddleware.js";
import { initializeSocketIO } from "./services/socket.service.js";
import models from "./models/index.js";

// Load environment variables
dotenv.config();

// ==================== Environment Validation ====================
// Validate required environment variables before starting server
import { validateAndExit } from "./utils/env-validation.util.js";
validateAndExit();

// ==================== Sentry Initialization ====================
// Initialize error tracking (must be done before other code)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || "development",
  });
  logInfo("Sentry initialized");
}

// ==================== Swagger Documentation Setup ====================
// Load Swagger JSON for API documentation
const swaggerPath = path.resolve(process.cwd(), "src", "swagger.json");
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

// ==================== Express App Initialization ====================
const app = express();

// ==================== Middleware Configuration ====================
// Enable CORS for cross-origin requests
app.use(
  cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  })
);

// Security headers (must be before other middleware)
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

// Compression middleware (reduces response size by 70-80%)
app.use(compression());

// Parse cookies from requests
app.use(cookieParser());

// Parse JSON request bodies
app.use(bodyParser.json());

// Parse URL-encoded request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// ==================== Server Configuration ====================
const PORT = process.env.PORT || PORT_CONFIG.START_PORT;

// ==================== Database Connection ====================
// Initialize database connection
connectToDatabase();

// ==================== Redis Connection Check ====================
// Wait for Redis to be ready with timeout
(async () => {
  try {
    const timeout = TIMEOUTS.REDIS_READY_CHECK;
    const startTime = Date.now();

    // Poll Redis connection status
    while (!isRedisConnected() && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (isRedisConnected()) {
      logInfo("Redis cache is available");
    } else {
      logWarn("Redis cache is not available - falling back to DB only");
    }
  } catch (error) {
    logWarn("Redis cache is not available - falling back to DB only");
  }
})();

// ==================== Database Synchronization ====================
// Sync database models (only if DB_SYNC=true)
if (process.env.DB_SYNC === "true") {
  (async () => {
    try {
      await models.syncDatabase(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logWarn("Failed to sync database models", { error: msg });
    }
  })();
}

// ==================== Security Middleware ====================
// Apply rate limiting, body size limits, and request timeouts
app.use(
  securityStack({
    maxRequests: RATE_LIMITING.MAX_REQUESTS,
    windowMs: RATE_LIMITING.WINDOW_MS,
    maxBodySize: RATE_LIMITING.MAX_BODY_SIZE,
    timeout: TIMEOUTS.REQUEST_TIMEOUT,
  })
);

// ==================== API Documentation ====================
// Serve Swagger UI at /docs and /api/docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ==================== API Routes ====================
// All API routes are prefixed with /api
app.use("/api", routes);

// ==================== Error Handling ====================
// Global error handler with Sentry integration
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Capture error in Sentry if configured
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  // Log error
  logError("Unhandled error", err);

  // Send error response
  res.status(err.statusCode || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message || "Internal server error",
  });
});

// ==================== WebSocket Server ====================
// Create HTTP server and initialize Socket.IO
const httpServer = createServer(app);
const io = initializeSocketIO(httpServer);

// Store Socket.IO instance globally for use in other modules
declare global {
  var socketIO: any;
}
global.socketIO = io;

// ==================== Server Startup ====================
// Start server with graceful port conflict handling
const START_PORT = Number(process.env.PORT || PORT) || PORT_CONFIG.START_PORT;
const MAX_PORT_ATTEMPTS = PORT_CONFIG.MAX_PORT_ATTEMPTS;

/**
 * Attempt to start server on specified port
 * If port is in use, tries next available port up to MAX_PORT_ATTEMPTS
 */
function tryListen(port: number, attemptsLeft: number) {
  httpServer.once("error", (err: any) => {
    if (err && err.code === "EADDRINUSE") {
      logWarn(`Port ${port} is already in use`);

      if (attemptsLeft > 0) {
        const nextPort = port + 1;
        logInfo(`Trying port ${nextPort}...`);
        tryListen(nextPort, attemptsLeft - 1);
      } else {
        logError(
          `All port retry attempts failed. Please free port ${port} or set PORT environment variable.`
        );
        process.exit(1);
      }
    } else {
      logError(`Server failed to start: ${err?.message ?? "Unknown error"}`);
      process.exit(1);
    }
  });

  httpServer.listen(port, "0.0.0.0", () => {
    logInfo(`Server listening on port ${port}`);
    logInfo(`API Documentation: http://localhost:${port}/docs`);
  });
}

// Start the server
tryListen(START_PORT, MAX_PORT_ATTEMPTS);

// ==================== Graceful Shutdown ====================
// Handle graceful shutdown for production deployments
const gracefulShutdown = async (signal: string) => {
  logWarn(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(async () => {
    logInfo("HTTP server closed");

    try {
      // Close Socket.IO connections
      io.close(() => {
        logInfo("Socket.IO connections closed");
      });

      // Disconnect Redis
      const { disconnectRedis } = await import("./config/redis.config.js");
      await disconnectRedis();
      logInfo("Redis disconnected");

      // Close database connections
      const sequelize = (await import("./db/database.config.js")).default;
      await sequelize.close();
      logInfo("Database connections closed");

      logInfo("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logError("Error during graceful shutdown", error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logError("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

// Listen for termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logError("Uncaught Exception", error);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  logError("Unhandled Rejection", reason, { promise });
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
  gracefulShutdown("UNHANDLED_REJECTION");
});
