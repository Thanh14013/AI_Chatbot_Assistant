/**
 * Migration: Optimize Message Indexes for Performance
 * Adds composite indexes for keyset pagination and query optimization
 * Created: 2025-11-18
 */

export async function up(queryInterface, Sequelize) {
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
}

export async function down(queryInterface, Sequelize) {
  try {
    await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_messages_conversation_count;");
  } catch (e) {}

  try {
    await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_messages_conversation_pinned;");
  } catch (e) {}

  try {
    await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_messages_keyset_pagination;");
  } catch (e) {}
}
