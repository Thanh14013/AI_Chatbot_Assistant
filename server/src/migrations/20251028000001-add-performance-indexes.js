/**
 * Migration: Add Performance Indexes
 * Adds missing indexes to optimize frequent queries
 * Created: 2025-10-28
 */

export async function up(queryInterface, Sequelize) {
  // Note: Some indexes already exist in model definitions, we only add missing ones

  console.log("Adding performance indexes...");

  try {
    // 1. Index for active conversations by user (composite partial index)
    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_user_active 
        ON conversations(user_id, "updatedAt" DESC, deleted_at)
        WHERE deleted_at IS NULL;
      `);
    console.log("✅ Added idx_conversations_user_active");
  } catch (error) {
    console.log("⚠️  Skipped idx_conversations_user_active:", error.message);
  }

  try {
    // 2. Index for file uploads by message (for join queries)
    await queryInterface.addIndex("file_uploads", ["message_id"], {
      name: "idx_file_uploads_message",
      using: "BTREE",
    });
    console.log("✅ Added idx_file_uploads_message");
  } catch (error) {
    console.log("⚠️  Skipped idx_file_uploads_message:", error.message);
  }

  try {
    // 3. Index for pinned messages (partial index)
    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_pinned 
        ON messages(conversation_id, pinned, "createdAt" DESC)
        WHERE pinned = true;
      `);
    console.log("✅ Added idx_messages_pinned");
  } catch (error) {
    console.log("⚠️  Skipped idx_messages_pinned:", error.message);
  }

  try {
    // 4. Index for refresh tokens by token value (for fast lookup)
    await queryInterface.addIndex("refresh_tokens", ["token"], {
      name: "idx_refresh_tokens_token",
      using: "HASH",
    });
    console.log("✅ Added idx_refresh_tokens_token");
  } catch (error) {
    console.log("⚠️  Skipped idx_refresh_tokens_token:", error.message);
  }

  try {
    // 5. Index for refresh tokens by user (for cleanup)
    await queryInterface.addIndex("refresh_tokens", ["user_id", "revoked"], {
      name: "idx_refresh_tokens_user_revoked",
      using: "BTREE",
    });
    console.log("✅ Added idx_refresh_tokens_user_revoked");
  } catch (error) {
    console.log("⚠️  Skipped idx_refresh_tokens_user_revoked:", error.message);
  }

  try {
    // 6. Index for conversations by project and order
    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_project_order 
        ON conversations(project_id, order_in_project)
        WHERE project_id IS NOT NULL;
      `);
    console.log("✅ Added idx_conversations_project_order");
  } catch (error) {
    console.log("⚠️  Skipped idx_conversations_project_order:", error.message);
  }

  // Try to add message_embeddings index only if table exists
  try {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_embeddings';",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (tables.length > 0) {
      await queryInterface.addIndex("message_embeddings", ["conversation_id"], {
        name: "idx_message_embeddings_conversation",
        using: "BTREE",
      });
      console.log("✅ Added idx_message_embeddings_conversation");
    } else {
      console.log("⚠️  Skipped idx_message_embeddings_conversation: table doesn't exist");
    }
  } catch (error) {
    console.log("⚠️  Skipped idx_message_embeddings_conversation:", error.message);
  }

  console.log("✅ Performance indexes migration completed");
}

export async function down(queryInterface, Sequelize) {
  console.log("Removing performance indexes...");

  // Remove all added indexes (ignore errors if they don't exist)
  try {
    await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_conversations_project_order;");
  } catch (e) {}

  try {
    await queryInterface.removeIndex("refresh_tokens", "idx_refresh_tokens_user_revoked");
  } catch (e) {}

  try {
    await queryInterface.removeIndex("refresh_tokens", "idx_refresh_tokens_token");
  } catch (e) {}

  try {
    await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_messages_pinned;");
  } catch (e) {}

  try {
    await queryInterface.removeIndex("file_uploads", "idx_file_uploads_message");
  } catch (e) {}

  try {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_embeddings';",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (tables.length > 0) {
      await queryInterface.removeIndex("message_embeddings", "idx_message_embeddings_conversation");
    }
  } catch (e) {}

  try {
    await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_conversations_user_active;");
  } catch (e) {}

  console.log("✅ Performance indexes removed");
}
