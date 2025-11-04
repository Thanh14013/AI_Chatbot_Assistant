import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

/**
 * Redis Configuration
 * Connection pooling and error handling for Redis cache
 */

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1", // Use 127.0.0.1 instead of localhost
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD : undefined,
  db: parseInt(process.env.REDIS_DB || "0"),
  retryStrategy: (times: number) => {
    // Stop retrying after 10 attempts to prevent infinite loop
    if (times > 10) {
      console.error("Redis: Max retry attempts (10) reached. Stopping retry.");
      return null; // Return null to stop retrying
    }
    // Exponential backoff with max 2 seconds delay
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
redisClient.on("connect", () => {});

redisClient.on("ready", () => {});

redisClient.on("error", (error: Error) => {});

redisClient.on("close", () => {
  console.warn("⚠ Redis connection closed");
});

redisClient.on("reconnecting", () => {});

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
  } catch (error) {
    console.error("Error disconnecting Redis:", error);
  }
};

// Export Redis client instance
export default redisClient;
