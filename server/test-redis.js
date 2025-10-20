// Quick Redis Connection Test
import { Redis } from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6379,
  db: 0,
});

redis.on("connect", () => {
  console.log("✓ Redis connected successfully");
});

redis.on("ready", () => {
  console.log("✓ Redis is ready");
  testRedis();
});

redis.on("error", (err) => {
  console.error("✗ Redis error:", err.message);
  process.exit(1);
});

async function testRedis() {
  try {
    // Test SET
    await redis.set("test:key", "Hello Redis!");
    console.log("✓ SET test:key");

    // Test GET
    const value = await redis.get("test:key");
    console.log("✓ GET test:key:", value);

    // Test TTL
    await redis.setex("test:ttl", 10, "expires in 10s");
    const ttl = await redis.ttl("test:ttl");
    console.log("✓ TTL test:ttl:", ttl, "seconds");

    // Test DEL
    await redis.del("test:key", "test:ttl");
    console.log("✓ DEL test keys");

    // Test PING
    const pong = await redis.ping();
    console.log("✓ PING:", pong);

    console.log("\n🎉 All Redis tests passed!");
    process.exit(0);
  } catch (err) {
    console.error("✗ Test failed:", err.message);
    process.exit(1);
  }
}
