import redisClient, { isRedisConnected } from "../config/redis.config.js";
import { handleError } from "../utils/error-handler.js";
export const CACHE_TTL = {
    USER: 3600,
    CONVERSATION_LIST: 300,
    MESSAGE_HISTORY: 600,
    CONTEXT: 300,
    SEMANTIC_SEARCH: 1800,
    REFRESH_TOKEN: 604800,
};
export async function getCache(key) {
    try {
        if (!isRedisConnected()) {
            return null;
        }
        const data = await redisClient.get(key);
        if (!data) {
            return null;
        }
        return JSON.parse(data);
    }
    catch (error) {
        return null;
    }
}
export async function setCache(key, value, ttl) {
    try {
        if (!isRedisConnected()) {
            return;
        }
        const serialized = JSON.stringify(value);
        if (ttl) {
            await redisClient.setex(key, ttl, serialized);
        }
        else {
            await redisClient.set(key, serialized);
        }
    }
    catch (error) {
    }
}
export async function deleteCache(key) {
    try {
        if (!isRedisConnected()) {
            return;
        }
        const result = await redisClient.del(key);
        if (result > 0) {
        }
    }
    catch (error) {
        handleError(error, { operation: "deleteCache", key });
    }
}
export async function invalidateCachePattern(pattern) {
    try {
        if (!isRedisConnected()) {
            return 0;
        }
        const keys = [];
        let cursor = "0";
        do {
            const [nextCursor, matchedKeys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
            cursor = nextCursor;
            keys.push(...matchedKeys);
        } while (cursor !== "0");
        if (keys.length > 0) {
            await redisClient.del(...keys);
            return keys.length;
        }
        return 0;
    }
    catch (error) {
        return 0;
    }
}
export async function existsCache(key) {
    try {
        if (!isRedisConnected()) {
            return false;
        }
        const exists = await redisClient.exists(key);
        return exists === 1;
    }
    catch (error) {
        return false;
    }
}
export async function getTTL(key) {
    try {
        if (!isRedisConnected()) {
            return -2;
        }
        return await redisClient.ttl(key);
    }
    catch (error) {
        return -2;
    }
}
export async function cacheAside(key, fetchFn, ttl) {
    const startTime = Date.now();
    const cached = await getCache(key);
    if (cached !== null) {
        const elapsed = Date.now() - startTime;
        return cached;
    }
    const dbStartTime = Date.now();
    const data = await fetchFn();
    const dbElapsed = Date.now() - dbStartTime;
    setCache(key, data, ttl).catch(() => {
    });
    const totalElapsed = Date.now() - startTime;
    return data;
}
export async function flushAllCache() {
    try {
        if (!isRedisConnected()) {
            return;
        }
        await redisClient.flushdb();
    }
    catch (error) {
        handleError(error, { operation: "flushAllCache" });
    }
}
export default {
    getCache,
    setCache,
    deleteCache,
    invalidateCachePattern,
    existsCache,
    getTTL,
    cacheAside,
    flushAllCache,
    CACHE_TTL,
};
