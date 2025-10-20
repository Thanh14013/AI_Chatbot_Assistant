import redisClient, { isRedisConnected } from "../config/redis.config.js";

/**
 * Base Cache Service
 * Generic cache operations with error handling and fallback
 */

/**
 * Cache configuration for different data types
 */
export const CACHE_TTL = {
  USER: 3600, // 1 hour
  CONVERSATION_LIST: 300, // 5 minutes
  MESSAGE_HISTORY: 600, // 10 minutes
  CONTEXT: 300, // 5 minutes
  SEMANTIC_SEARCH: 1800, // 30 minutes
  REFRESH_TOKEN: 604800, // 7 days
} as const;

/**
 * Get value from cache
 * @param key - Cache key
 * @returns Cached value or null if not found
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (!isRedisConnected()) {
      console.warn("⚠️  [CACHE] Redis not connected, cache miss");
      return null;
    }

    const data = await redisClient.get(key);
    if (!data) {
      console.log(`❌ [CACHE MISS] Key: ${key}`);
      return null;
    }

    console.log(`✅ [CACHE HIT] Key: ${key}`);
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`❌ [CACHE ERROR] GET failed for key ${key}:`, error);
    return null; // Fail gracefully, return null on error
  }
}

/**
 * Set value in cache with TTL
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Time to live in seconds (optional)
 */
export async function setCache<T>(key: string, value: T, ttl?: number): Promise<void> {
  try {
    if (!isRedisConnected()) {
      console.warn("⚠️  [CACHE] Redis not connected, skipping cache set");
      return;
    }

    const serialized = JSON.stringify(value);

    if (ttl) {
      await redisClient.setex(key, ttl, serialized);
      console.log(`💾 [CACHE SET] Key: ${key} (TTL: ${ttl}s)`);
    } else {
      await redisClient.set(key, serialized);
      console.log(`💾 [CACHE SET] Key: ${key} (No TTL)`);
    }
  } catch (error) {
    console.error(`❌ [CACHE ERROR] SET failed for key ${key}:`, error);
    // Fail gracefully, don't throw error
  }
}

/**
 * Delete specific key from cache
 * @param key - Cache key to delete
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    if (!isRedisConnected()) {
      return;
    }

    const result = await redisClient.del(key);
    if (result > 0) {
      console.log(`🗑️  [CACHE DELETE] Key: ${key}`);
    }
  } catch (error) {
    console.error(`❌ [CACHE ERROR] DELETE failed for key ${key}:`, error);
  }
}

/**
 * Delete multiple keys matching a pattern
 * @param pattern - Pattern to match (e.g., "user:*")
 * @returns Number of keys deleted
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
  try {
    if (!isRedisConnected()) {
      return 0;
    }

    // Scan for keys matching pattern
    const keys: string[] = [];
    let cursor = "0";

    do {
      const [nextCursor, matchedKeys] = await redisClient.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      keys.push(...matchedKeys);
    } while (cursor !== "0");

    // Delete all matched keys
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`🗑️  [CACHE INVALIDATE] Pattern: ${pattern} (${keys.length} keys deleted)`);
      return keys.length;
    }

    return 0;
  } catch (error) {
    console.error(`❌ [CACHE ERROR] INVALIDATE PATTERN failed for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Check if a key exists in cache
 * @param key - Cache key
 * @returns True if key exists
 */
export async function existsCache(key: string): Promise<boolean> {
  try {
    if (!isRedisConnected()) {
      return false;
    }

    const exists = await redisClient.exists(key);
    return exists === 1;
  } catch (error) {
    console.error(`Cache EXISTS error for key ${key}:`, error);
    return false;
  }
}

/**
 * Get remaining TTL for a key
 * @param key - Cache key
 * @returns Remaining TTL in seconds, -1 if no TTL, -2 if key doesn't exist
 */
export async function getTTL(key: string): Promise<number> {
  try {
    if (!isRedisConnected()) {
      return -2;
    }

    return await redisClient.ttl(key);
  } catch (error) {
    console.error(`Cache TTL error for key ${key}:`, error);
    return -2;
  }
}

/**
 * Cache-aside pattern helper
 * Tries to get from cache first, if miss, fetches from DB and caches result
 *
 * @param key - Cache key
 * @param fetchFn - Function to fetch data if cache miss
 * @param ttl - Time to live in seconds
 * @returns Data from cache or fetch function
 */
export async function cacheAside<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number
): Promise<T> {
  const startTime = Date.now();

  // Try cache first
  const cached = await getCache<T>(key);
  if (cached !== null) {
    const elapsed = Date.now() - startTime;
    console.log(`⚡ [CACHE-ASIDE HIT] Served from Redis in ${elapsed}ms`);
    return cached;
  }

  // Cache miss - fetch from source
  console.log(`🔍 [CACHE-ASIDE MISS] Fetching from DB...`);
  const dbStartTime = Date.now();
  const data = await fetchFn();
  const dbElapsed = Date.now() - dbStartTime;
  console.log(`📊 [DB QUERY] Completed in ${dbElapsed}ms`);

  // Store in cache for next time (don't await, fire and forget)
  setCache(key, data, ttl).catch(() => {
    // Ignore cache set errors
  });

  const totalElapsed = Date.now() - startTime;
  console.log(`⏱️  [CACHE-ASIDE] Total time: ${totalElapsed}ms (DB: ${dbElapsed}ms)`);

  return data;
}

/**
 * Flush all cache (use with caution!)
 */
export async function flushAllCache(): Promise<void> {
  try {
    if (!isRedisConnected()) {
      return;
    }

    await redisClient.flushdb();
    console.log("✓ Cache flushed successfully");
  } catch (error) {
    console.error("Cache FLUSH error:", error);
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
