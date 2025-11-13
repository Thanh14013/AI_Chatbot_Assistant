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
import { PORT as PORT_CONFIG, TIMEOUTS, RATE_LIMITING } from "./config/constants.js";
import { isRedisConnected } from "./config/redis.config.js";
import { logInfo, logError, logWarn } from "./utils/logger.util.js";
import connectToDatabase from "./db/database.connection.js";
import routes from "./routes/index.js";
import { securityStack } from "./middlewares/generalMiddleware.js";
import { initializeSocketIO } from "./services/socket.service.js";
import models from "./models/index.js";
dotenv.config();
import { validateAndExit } from "./utils/env-validation.util.js";
validateAndExit();
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
const swaggerPath = path.resolve(process.cwd(), "src", "swagger.json");
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));
const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
        : true,
    credentials: true,
}));
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const PORT = process.env.PORT || PORT_CONFIG.START_PORT;
connectToDatabase();
(async () => {
    try {
        const timeout = TIMEOUTS.REDIS_READY_CHECK;
        const startTime = Date.now();
        while (!isRedisConnected() && Date.now() - startTime < timeout) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (isRedisConnected()) {
            logInfo("Redis cache is available");
        }
        else {
            logWarn("Redis cache is not available - falling back to DB only");
        }
    }
    catch (error) {
        logWarn("Redis cache is not available - falling back to DB only");
    }
})();
if (process.env.DB_SYNC === "true") {
    (async () => {
        try {
            await models.syncDatabase(false);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logWarn("Failed to sync database models", { error: msg });
        }
    })();
}
app.use(securityStack({
    maxRequests: RATE_LIMITING.MAX_REQUESTS,
    windowMs: RATE_LIMITING.WINDOW_MS,
    maxBodySize: RATE_LIMITING.MAX_BODY_SIZE,
    timeout: TIMEOUTS.REQUEST_TIMEOUT,
}));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api", routes);
app.use((err, _req, res, _next) => {
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
    }
    logError("Unhandled error", err);
    res.status(err.statusCode || 500).json({
        success: false,
        message: process.env.NODE_ENV === "production"
            ? "An unexpected error occurred"
            : err.message || "Internal server error",
    });
});
const httpServer = createServer(app);
const io = initializeSocketIO(httpServer);
global.socketIO = io;
const START_PORT = Number(process.env.PORT || PORT) || PORT_CONFIG.START_PORT;
const MAX_PORT_ATTEMPTS = PORT_CONFIG.MAX_PORT_ATTEMPTS;
function tryListen(port, attemptsLeft) {
    httpServer.once("error", (err) => {
        if (err && err.code === "EADDRINUSE") {
            logWarn(`Port ${port} is already in use`);
            if (attemptsLeft > 0) {
                const nextPort = port + 1;
                logInfo(`Trying port ${nextPort}...`);
                tryListen(nextPort, attemptsLeft - 1);
            }
            else {
                logError(`All port retry attempts failed. Please free port ${port} or set PORT environment variable.`);
                process.exit(1);
            }
        }
        else {
            logError(`Server failed to start: ${err?.message ?? "Unknown error"}`);
            process.exit(1);
        }
    });
    httpServer.listen(port, () => {
        logInfo(`Server listening on port ${port}`);
        logInfo(`API Documentation: http://localhost:${port}/docs`);
    });
}
tryListen(START_PORT, MAX_PORT_ATTEMPTS);
const gracefulShutdown = async (signal) => {
    logWarn(`${signal} received. Starting graceful shutdown...`);
    httpServer.close(async () => {
        logInfo("HTTP server closed");
        try {
            io.close(() => {
                logInfo("Socket.IO connections closed");
            });
            const { disconnectRedis } = await import("./config/redis.config.js");
            await disconnectRedis();
            logInfo("Redis disconnected");
            const sequelize = (await import("./db/database.config.js")).default;
            await sequelize.close();
            logInfo("Database connections closed");
            logInfo("Graceful shutdown completed");
            process.exit(0);
        }
        catch (error) {
            logError("Error during graceful shutdown", error);
            process.exit(1);
        }
    });
    setTimeout(() => {
        logError("Forced shutdown after timeout");
        process.exit(1);
    }, 30000);
};
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => {
    logError("Uncaught Exception", error);
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(error);
    }
    gracefulShutdown("UNCAUGHT_EXCEPTION");
});
process.on("unhandledRejection", (reason, promise) => {
    logError("Unhandled Rejection", reason, { promise });
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(reason);
    }
    gracefulShutdown("UNHANDLED_REJECTION");
});
