import { Redis } from "ioredis";

async function testRedis() {
  console.log("🔍 Testing Redis with ioredis...\n");

  const redisClient = new Redis({
    host: "127.0.0.1", // Try IPv4 instead of localhost
    port: 6379,
    password: undefined,
    db: 0,
    retryStrategy: (times) => {
      console.log(`Retry attempt ${times}`);
      if (times > 3) return null;
      return Math.min(times * 50, 2000);
    },
    lazyConnect: true,
  });

  redisClient.on("connect", () => {
    console.log("✅ Redis connecting...");
  });

  redisClient.on("ready", () => {
    console.log("✅ Redis ready!");
  });

  redisClient.on("error", (error) => {
    console.log("❌ Redis error:", error.message);
  });

  redisClient.on("close", () => {
    console.log("⚠ Redis connection closed");
  });

  try {
    console.log("Attempting to connect...");
    await redisClient.connect();

    console.log("\n✅✅✅ Redis connected! ✅✅✅\n");

    const pong = await redisClient.ping();
    console.log(`PING response: ${pong}`);

    await redisClient.set("test-key", "Hello from ioredis!");
    const value = await redisClient.get("test-key");
    console.log(`Test SET/GET: ${value}`);

    await redisClient.quit();
    console.log("\n✅ Redis test completed successfully!");
  } catch (error) {
    console.log("\n❌ Connection failed:", error.message);
    console.log("Error details:", error);
  }
}

testRedis().catch(console.error);
