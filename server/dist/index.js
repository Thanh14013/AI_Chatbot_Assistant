/**
 * Main Server Entry Point
 * Initializes Express server with all necessary middleware and configurations
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
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
// Import core services
import connectToDatabase from "./db/database.connection.js";
import routes from "./routes/index.js";
import { securityStack } from "./middlewares/generalMiddleware.js";
import { initializeSocketIO } from "./services/socket.service.js";
import models from "./models/index.js";
// Load environment variables
dotenv.config();
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
    console.log("✅ Sentry initialized");
}
// ==================== Swagger Documentation Setup ====================
// Load Swagger JSON for API documentation
const swaggerPath = path.resolve(process.cwd(), "src", "swagger.json");
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));
// ==================== Express App Initialization ====================
const app = express();
// ==================== Middleware Configuration ====================
// Enable CORS for cross-origin requests
app.use(cors({
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
        : true,
    credentials: true,
}));
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
            console.log("✓ Redis cache is available");
        }
        else {
            console.warn("⚠ Redis cache is not available - falling back to DB only");
        }
    }
    catch (error) {
        console.warn("⚠ Redis cache is not available - falling back to DB only");
    }
})();
// ==================== Database Synchronization ====================
// Sync database models (only if DB_SYNC=true)
if (process.env.DB_SYNC === "true") {
    (async () => {
        try {
            await models.syncDatabase(false);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("Failed to sync database models:", msg);
        }
    })();
}
// ==================== Security Middleware ====================
// Apply rate limiting, body size limits, and request timeouts
app.use(securityStack({
    maxRequests: RATE_LIMITING.MAX_REQUESTS,
    windowMs: RATE_LIMITING.WINDOW_MS,
    maxBodySize: RATE_LIMITING.MAX_BODY_SIZE,
    timeout: TIMEOUTS.REQUEST_TIMEOUT,
}));
// ==================== API Documentation ====================
// Serve Swagger UI at /docs and /api/docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// ==================== API Routes ====================
// All API routes are prefixed with /api
app.use("/api", routes);
// ==================== Error Handling ====================
// Global error handler with Sentry integration
app.use((err, req, res, next) => {
    // Capture error in Sentry if configured
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
    }
    // Log error to console
    console.error("Unhandled error:", err);
    // Send error response
    res.status(err.statusCode || 500).json({
        success: false,
        message: process.env.NODE_ENV === "production"
            ? "An unexpected error occurred"
            : err.message || "Internal server error",
    });
});
// ==================== WebSocket Server ====================
// Create HTTP server and initialize Socket.IO
const httpServer = createServer(app);
const io = initializeSocketIO(httpServer);
global.socketIO = io;
// ==================== Server Startup ====================
// Start server with graceful port conflict handling
const START_PORT = Number(process.env.PORT || PORT) || PORT_CONFIG.START_PORT;
const MAX_PORT_ATTEMPTS = PORT_CONFIG.MAX_PORT_ATTEMPTS;
/**
 * Attempt to start server on specified port
 * If port is in use, tries next available port up to MAX_PORT_ATTEMPTS
 */
function tryListen(port, attemptsLeft) {
    httpServer.once("error", (err) => {
        if (err && err.code === "EADDRINUSE") {
            console.warn(`⚠ Port ${port} is already in use.`);
            if (attemptsLeft > 0) {
                const nextPort = port + 1;
                console.log(`Trying port ${nextPort}...`);
                tryListen(nextPort, attemptsLeft - 1);
            }
            else {
                console.error(`❌ All port retry attempts failed. Please free port ${port} or set PORT environment variable.`);
                process.exit(1);
            }
        }
        else {
            console.error(`❌ Server failed to start: ${err?.message ?? "Unknown error"}`);
            process.exit(1);
        }
    });
    httpServer.listen(port, () => {
        console.log(`✅ Server listening on port ${port}`);
        console.log(`📚 API Documentation: http://localhost:${port}/docs`);
    });
}
// Start the server
tryListen(START_PORT, MAX_PORT_ATTEMPTS);
