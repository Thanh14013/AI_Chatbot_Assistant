import pg from "pg";
const { Client } = pg;

async function testPasswords() {
  const passwords = ["postgres", "thanh123", "password", "123456", "", "chatbot"];
  const databases = ["postgres", "chatbot", "ai_chatbot"];

  console.log("🔍 Testing different password combinations...\n");

  for (const password of passwords) {
    for (const dbName of databases) {
      const connectionString = `postgresql://postgres:${password}@localhost:5432/${dbName}`;
      const client = new Client({ connectionString });

      try {
        await client.connect();
        console.log(`✅✅✅ SUCCESS! ✅✅✅`);
        console.log(`Database: ${dbName}`);
        console.log(`Password: ${password}`);
        console.log(
          `\nConnection String: postgresql://postgres:${password}@localhost:5432/${dbName}\n`
        );

        // List all databases
        const result = await client.query(`
          SELECT datname FROM pg_database 
          WHERE datistemplate = false 
          ORDER BY datname;
        `);

        console.log("Available databases in this PostgreSQL:");
        result.rows.forEach((row) => {
          console.log(`  - ${row.datname}`);
        });

        await client.end();
        return; // Exit after first success
      } catch (error) {
        // Silent fail, keep trying
      }
    }
  }

  console.log("❌ No valid password found!");
}

testPasswords().catch(console.error);
