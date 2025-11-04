import { createClient } from "redis";

async function testRedis() {
  console.log("🔍 Testing Redis connection...\n");
  console.log("Host: localhost:6379\n");

  const client = createClient({
    socket: {
      host: "localhost",
      port: 6379,
    },
  });

  client.on("error", (err) => {
    console.log("❌ Redis Error:", err.message);
  });

  client.on("connect", () => {
    console.log("✅ Redis connecting...");
  });

  client.on("ready", () => {
    console.log("✅ Redis ready!");
  });

  try {
    await client.connect();
    console.log("✅✅✅ Redis connected successfully! ✅✅✅\n");

    const pong = await client.ping();
    console.log(`PING response: ${pong}\n`);

    // Test set/get
    await client.set("test-key", "Hello Redis!");
    const value = await client.get("test-key");
    console.log(`Test SET/GET: ${value}`);

    await client.disconnect();
    console.log("\n✅ Redis test completed!");
  } catch (error) {
    console.log("\n❌ Redis connection failed:", error.message);
  }
}

testRedis().catch(console.error);
