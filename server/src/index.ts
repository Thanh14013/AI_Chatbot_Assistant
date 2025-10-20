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

// Load swagger JSON at runtime to avoid import-assertion issues in some Node setups
const swaggerPath = path.resolve(process.cwd(), "src", "swagger.json");
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

// Initialize Express app
const app = express();

// Load environment variables from .env file
dotenv.config();

// Enable CORS for cross-origin requests and allow credentials for cookies
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
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
const PORT = process.env.PORT || 3000;

// Initialize Database Connection
connectToDatabase();

// Wait for Redis to be ready (with timeout)
// This ensures we check the connection status AFTER Redis has attempted to connect
(async () => {
  try {
    // Wait up to 4 seconds for Redis to become ready
    const timeout = 4000;
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
    maxRequests: 1000, // 1000 requests
    windowMs: 60 * 60 * 1000, // 1 hour
    maxBodySize: 2 * 1024 * 1024, // 2MB
    timeout: 30000, // 30 seconds
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
const START_PORT = Number(process.env.PORT || PORT) || 3000;
const MAX_PORT_ATTEMPTS = 10;

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
