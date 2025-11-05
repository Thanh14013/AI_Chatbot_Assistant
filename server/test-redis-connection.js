import { createClient } from "redis";

async function testRedis() {
  // logging removed for cleaner output

  const client = createClient({
    socket: {
      host: "localhost",
      port: 6379,
    },
  });

  client.on("error", (err) => {
    // logging removed
  });

  client.on("connect", () => {
    // logging removed
  });

  client.on("ready", () => {
    // logging removed
  });

  try {
    await client.connect();
    // logging removed

    const pong = await client.ping();
    // logging removed

    // Test set/get
    await client.set("test-key", "Hello Redis!");
    const value = await client.get("test-key");
    // logging removed

    await client.disconnect();
    // logging removed
  } catch (error) {
    // logging removed
  }
}

testRedis().catch(() => {});
