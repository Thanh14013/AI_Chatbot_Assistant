import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import connectToDatabase from "./db/database.connection.js";
import routes from "./routes/index.js";

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

// Configure API Routes
// All routes are prefixed with /api
app.use("/api", routes);

// Start Server
// Listen on configured port
app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API routes: http://localhost:${PORT}/api`);
  console.log("=".repeat(50));
});
