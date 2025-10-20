import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

/**
 * Redis Configuration
 * Connection pooling and error handling for Redis cache
 */

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0"),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  // Suppress Redis 7 ACL warning from ioredis
  showFriendlyErrorStack: process.env.NODE_ENV !== "production",
};

// Create Redis client instance
const redisClient = new Redis(redisConfig);

// Connection event handlers
redisClient.on("connect", () => {
  console.log("✓ Redis connected successfully");
});

redisClient.on("ready", () => {
  console.log("✓ Redis is ready to accept commands");
});

redisClient.on("error", (error: Error) => {
  console.error("✗ Redis connection error:", error.message);
});

redisClient.on("close", () => {
  console.warn("⚠ Redis connection closed");
});

redisClient.on("reconnecting", () => {
  console.log("↻ Redis reconnecting...");
});

/**
 * Check if Redis is connected and ready
 */
export const isRedisConnected = (): boolean => {
  return redisClient.status === "ready";
};

/**
 * Graceful shutdown - disconnect Redis
 */
export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    console.log("✓ Redis disconnected gracefully");
  } catch (error) {
    console.error("✗ Error disconnecting Redis:", error);
  }
};

// Export Redis client instance
export default redisClient;
