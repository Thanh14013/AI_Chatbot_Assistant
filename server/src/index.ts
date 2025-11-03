import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import connectToDatabase from "./db/database.connection.js";
import routes from "./routes/index.js";
import { securityStack } from "./middlewares/generalMiddleware.js";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { initializeSocketIO } from "./services/socket.service.js";
import models from "./models/index.js";
import redisClient, { isRedisConnected } from "./config/redis.config.js";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { PORT as PORT_CONFIG, TIMEOUTS, RATE_LIMITING } from "./config/constants.js";

// Load environment variables first
dotenv.config();

// Initialize Sentry (must be before any other imports/code)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || "development",
  });
  console.log("✅ Sentry initialized");
}

// Load swagger JSON at runtime to avoid import-assertion issues in some Node setups
const swaggerPath = path.resolve(process.cwd(), "src", "swagger.json");
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

// Initialize Express app
const app = express();

// Sentry request handler (must be first middleware after app creation)
// This needs to be before all other middleware
if (process.env.SENTRY_DSN) {
  // No need for manual setup - Sentry automatically instruments Express
  console.log("✅ Sentry Express integration active");
}

// Enable CORS for cross-origin requests and allow credentials for cookies
app.use(
  cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  })
);

// Parse cookies
app.use(cookieParser());

// Parse JSON request bodies
app.use(bodyParser.json());

// Parse URL-encoded request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Server Configuration
const PORT = process.env.PORT || PORT_CONFIG.START_PORT;

// Initialize Database Connection
connectToDatabase();

// Wait for Redis to be ready (with timeout)
// This ensures we check the connection status AFTER Redis has attempted to connect
(async () => {
  try {
    // Wait up to TIMEOUTS.REDIS_READY_CHECK for Redis to become ready
    const timeout = TIMEOUTS.REDIS_READY_CHECK;
    const startTime = Date.now();

    while (!isRedisConnected() && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (isRedisConnected()) {
      console.log("✓ Redis cache is available");
    } else {
      console.warn("⚠ Redis cache is not available - falling back to DB only");
    }
  } catch (error) {
    console.warn("⚠ Redis cache is not available - falling back to DB only");
  }
})();

// Optionally synchronize models (non-destructive by default).
// Only perform schema sync when DB_SYNC environment variable is explicitly set to 'true'.
if (process.env.DB_SYNC === "true") {
  (async () => {
    try {
      await models.syncDatabase(false);
    } catch (err) {
      // Log a short message only (avoid printing full error stack in startup output)
      try {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Failed to sync database models:", msg);
      } catch {
        console.warn("Failed to sync database models");
      }
    }
  })();
}
// Security Middleware Stack
// Apply rate limiting, body size limits, and request timeouts
app.use(
  securityStack({
    maxRequests: RATE_LIMITING.MAX_REQUESTS,
    windowMs: RATE_LIMITING.WINDOW_MS,
    maxBodySize: RATE_LIMITING.MAX_BODY_SIZE,
    timeout: TIMEOUTS.REQUEST_TIMEOUT,
  })
);

// Configure API Routes
// Swagger UI - API Documentation
// Serve at both /docs and /api/docs. Mount these BEFORE the API router so
// the router doesn't intercept and return a 404 for /api/docs.
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Configure API Routes
// All routes are prefixed with /api
app.use("/api", routes);

// Sentry error handler middleware (must be after all routes, before other error handlers)
// Note: Sentry v8+ automatically instruments Express, just add manual error capture
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Capture error in Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  // Log error
  console.error("Unhandled error:", err);

  // Send response
  res.status(err.statusCode || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message || "Internal server error",
  });
});

// Create HTTP server and initialize Socket.io
const httpServer = createServer(app);
const io = initializeSocketIO(httpServer);

// Store io instance globally for use in other modules
declare global {
  var socketIO: any;
}
global.socketIO = io;

// Start Server with graceful EADDRINUSE handling
// Try to bind to the configured port; if it's in use, try the next ports up to a limit.
const START_PORT = Number(process.env.PORT || PORT) || PORT_CONFIG.START_PORT;
const MAX_PORT_ATTEMPTS = PORT_CONFIG.MAX_PORT_ATTEMPTS;

function tryListen(port: number, attemptsLeft: number) {
  httpServer.once("error", (err: any) => {
    if (err && err.code === "EADDRINUSE") {
      console.warn(`Port ${port} is already in use.`);
      if (attemptsLeft > 0) {
        const nextPort = port + 1;
        // Retry on next port
        tryListen(nextPort, attemptsLeft - 1);
      } else {
        // Minimal error output for fatal condition
        console.warn(
          `All port retry attempts failed. Please free port ${port} or set PORT environment variable to a free port.`
        );
        process.exit(1);
      }
    } else {
      // Unexpected error - surface minimal error info then exit
      console.error(err?.message ?? "Server failed to start");
      process.exit(1);
    }
  });

  httpServer.listen(port, () => {
    // Minimal startup info
    console.warn(`Server listening on port ${port}`);
  });
}

tryListen(START_PORT, MAX_PORT_ATTEMPTS);
