import { Redis } from "ioredis";

async function testRedis() {
  // logging removed for cleaner output

  const redisClient = new Redis({
    host: "127.0.0.1", // Try IPv4 instead of localhost
    port: 6379,
    password: undefined,
    db: 0,
    retryStrategy: (times) => {
      // logging removed
      if (times > 3) return null;
      return Math.min(times * 50, 2000);
    },
    lazyConnect: true,
  });

  redisClient.on("connect", () => {
    // logging removed
  });

  redisClient.on("ready", () => {
    // logging removed
  });

  redisClient.on("error", (error) => {
    // logging removed
  });

  redisClient.on("close", () => {
    // logging removed
  });

  try {
    // logging removed
    await redisClient.connect();

    // logging removed

    const pong = await redisClient.ping();
    // logging removed

    await redisClient.set("test-key", "Hello from ioredis!");
    const value = await redisClient.get("test-key");
    // logging removed

    await redisClient.quit();
    // logging removed
  } catch (error) {
    // logging removed
  }
}

testRedis().catch(() => {});
