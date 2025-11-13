import { Redis } from "ioredis";
import dotenv from "dotenv";
dotenv.config();
const redisConfig = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD : undefined,
    db: parseInt(process.env.REDIS_DB || "0"),
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
    retryStrategy: (times) => {
        if (times > 10) {
            return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    showFriendlyErrorStack: process.env.NODE_ENV !== "production",
};
const redisClient = new Redis(redisConfig);
redisClient.on("connect", () => { });
redisClient.on("ready", () => { });
redisClient.on("error", () => {
});
redisClient.on("close", () => {
});
redisClient.on("reconnecting", () => { });
export const isRedisConnected = () => {
    return redisClient.status === "ready";
};
export const disconnectRedis = async () => {
    try {
        await redisClient.quit();
    }
    catch (error) {
    }
};
export default redisClient;
