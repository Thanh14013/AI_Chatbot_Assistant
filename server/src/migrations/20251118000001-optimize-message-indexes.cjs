/**
 * Migration: Optimize Message Indexes for Performance
 * Adds composite indexes for keyset pagination and query optimization
 * Created: 2025-11-18
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add optimized composite indexes for messages
    try {
      // 1. Composite index for keyset pagination (conversation_id, createdAt DESC, id DESC)
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_keyset_pagination
        ON messages(conversation_id, "createdAt" DESC, id DESC);
      `);
    } catch (error) {
      // ignore - migration should continue
    }

    try {
      // 2. Index for pinned messages lookup (partial index)
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation_pinned
        ON messages(conversation_id, pinned, "createdAt" DESC)
        WHERE pinned = true;
      `);
    } catch (error) {
      // ignore
    }

    try {
      // 3. Covering / count-friendly index
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation_count
        ON messages(conversation_id);
      `);
    } catch (error) {
      // ignore
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_messages_conversation_count;");
    } catch (e) {}

    try {
      await queryInterface.sequelize.query(
        "DROP INDEX IF EXISTS idx_messages_conversation_pinned;"
      );
    } catch (e) {}

    try {
      await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_messages_keyset_pagination;");
    } catch (e) {}
  },
};
/**
 * Migration: Optimize Message Indexes for Performance
 * Adds composite indexes for keyset pagination and query optimization
 * Created: 2025-11-18
 */

import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function up() {
  console.log("🚀 Adding optimized composite indexes for messages...");

  try {
    // 1. Composite index for keyset pagination (conversation_id, createdAt, id)
    // This is the MOST IMPORTANT index for pagination performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_keyset_pagination 
      ON messages(conversation_id, "createdAt" DESC, id DESC);
    `);
    console.log("✅ Added keyset pagination index");
  } catch (error) {
    console.error("❌ Failed to add keyset pagination index:", error.message);
  }

  try {
    // 2. Index for pinned messages lookup (faster than existing partial index)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_pinned 
      ON messages(conversation_id, pinned, "createdAt" DESC)
      WHERE pinned = true;
    `);
    console.log("✅ Added optimized pinned messages index");
  } catch (error) {
    console.error("❌ Failed to add pinned messages index:", error.message);
  }

  try {
    // 3. Index for message count queries (covering index)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_count 
      ON messages(conversation_id) 
      INCLUDE (id);
    `);
    console.log("✅ Added covering index for count queries");
  } catch (error) {
    console.error("❌ Failed to add count index:", error.message);
  }

  console.log("✅ Message indexes optimization complete!");
}

async function down() {
  console.log("🔄 Removing optimized message indexes...");

  try {
    await pool.query("DROP INDEX IF EXISTS idx_messages_conversation_count;");
  } catch (e) {}

  try {
    await pool.query("DROP INDEX IF EXISTS idx_messages_conversation_pinned;");
  } catch (e) {}

  try {
    await pool.query("DROP INDEX IF EXISTS idx_messages_keyset_pagination;");
  } catch (e) {}

  console.log("✅ Message indexes removed");
}

// Run migration
(async () => {
  try {
    await up();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
})();
