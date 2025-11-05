import pg from "pg";
const { Client } = pg;

async function testPasswords() {
  const passwords = ["postgres", "thanh123", "password", "123456", "", "chatbot"];
  const databases = ["postgres", "chatbot", "ai_chatbot"];

  // logging removed for cleaner output

  for (const password of passwords) {
    for (const dbName of databases) {
      const connectionString = `postgresql://postgres:${password}@localhost:5432/${dbName}`;
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
        return; // Exit after first success
      } catch (error) {
        // Silent fail, keep trying
      }
    }
  }

  // logging removed
}

testPasswords().catch(() => {});
