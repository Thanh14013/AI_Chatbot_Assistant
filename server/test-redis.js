// Quick Redis Connection Test
import { Redis } from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6379,
  db: 0,
});

redis.on("connect", () => {});

redis.on("ready", () => {
  testRedis();
});

redis.on("error", (err) => {
  process.exit(1);
});

async function testRedis() {
  try {
    // Test SET
    await redis.set("test:key", "Hello Redis!");

    // Test GET
    const value = await redis.get("test:key");

    // Test TTL
    await redis.setex("test:ttl", 10, "expires in 10s");
    const ttl = await redis.ttl("test:ttl");

    // Test DEL
    await redis.del("test:key", "test:ttl");

    // Test PING
    const pong = await redis.ping();

    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}
