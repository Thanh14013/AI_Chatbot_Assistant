/**
 * Main Server Entry Point
 * Initializes Express server, middleware, and database connection
 */

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import connectToDatabase from "./db/database.connection.js";

// Initialize Express app
const app = express();

// Load environment variables from .env file
dotenv.config();

/**
 * Configure Middleware
 */
// Enable CORS for cross-origin requests
app.use(cors());

// Parse JSON request bodies
app.use(bodyParser.json());

// Parse URL-encoded request bodies
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Server Configuration
 */
const PORT = process.env.PORT || 3000;

/**
 * Initialize Database Connection
 * Test connection to PostgreSQL database
 */
connectToDatabase();

/**
 * Health Check Endpoint
 * Test if server is running
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Start Server
 * Listen on configured port
 */
app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log("=".repeat(50));
});
