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

  console.log("🔍 Testing PostgreSQL connections...\n");
  console.log("Host: localhost:5432");
  console.log("User: postgres");
  console.log("Password: thanh123\n");

  for (const config of configs) {
    const connectionString = `postgresql://postgres:thanh123@localhost:5432/${config.db}`;
    const client = new Client({ connectionString });

    try {
      await client.connect();
      console.log(`✅ Connected to "${config.db}" (${config.desc})`);

      // List all databases
      const result = await client.query(`
        SELECT datname FROM pg_database 
        WHERE datistemplate = false 
        ORDER BY datname;
      `);

      console.log("   Available databases:");
      result.rows.forEach((row) => {
        console.log(`   - ${row.datname}`);
      });

      await client.end();
      console.log("");
      break; // Stop after first successful connection
    } catch (error) {
      console.log(`❌ Cannot connect to "${config.db}": ${error.message}`);
    }
  }
}

listDatabases().catch(console.error);
