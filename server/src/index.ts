import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import connectToDatabase from "./db/database.connection.js";
import routes from "./routes/index.js";
import { securityStack } from "./middlewares/generalMiddleware.js";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { testOpenAIConnection } from "./services/openai.service.js";

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
// Test connection to PostgreSQL database
connectToDatabase();

// Import models to register associations
// Note: importing `./models/index` runs the association definitions.
import models from "./models/index.js";
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
} else {
  console.log("DB sync skipped (set DB_SYNC='true' to enable schema synchronization)");
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

// Start Server
// Listen on configured port
app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📡 API routes base: http://localhost:${PORT}/api`);
  console.log(`📘 Swagger UI: http://localhost:${PORT}/docs  (or /api/docs)`);
  console.log("=".repeat(50));
});
