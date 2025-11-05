import pg from "pg";
const { Client } = pg;

async function listDatabases() {
  // Test với các database names khác nhau
  const configs = [
    { db: "postgres", desc: "default postgres database" },
    { db: "chatbot", desc: "chatbot database" },
    { db: "ai_chatbot", desc: "ai_chatbot database" },
    { db: "chatbot_db", desc: "chatbot_db database" },
  ];

  // logging removed for cleaner output

  for (const config of configs) {
    const connectionString = `postgresql://postgres:thanh123@localhost:5432/${config.db}`;
    const client = new Client({ connectionString });

    try {
      await client.connect();
      // logging removed

      // List all databases
      const result = await client.query(`
        SELECT datname FROM pg_database 
        WHERE datistemplate = false 
        ORDER BY datname;
      `);

      // logging removed
      await client.end();
      break; // Stop after first successful connection
    } catch (error) {
      // logging removed
    }
  }
}

listDatabases().catch(() => {});
