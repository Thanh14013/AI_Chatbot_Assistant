/**
 * Migration: Add Performance Indexes
 * Adds missing indexes to optimize frequent queries
 * Created: 2025-10-28
 */

export async function up(queryInterface, Sequelize) {
  // Note: Some indexes already exist in model definitions, we only add missing ones

  // logging removed

  try {
    // 1. Index for active conversations by user (composite partial index)
    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_user_active 
        ON conversations(user_id, "updatedAt" DESC, deleted_at)
        WHERE deleted_at IS NULL;
      `);
    // logging removed
  } catch (error) {
    // logging removed
  }

  try {
    // 2. Index for file uploads by message (for join queries)
    await queryInterface.addIndex("files_upload", ["message_id"], {
      name: "idx_file_uploads_message",
      using: "BTREE",
    });
    // logging removed
  } catch (error) {
    // logging removed
  }

  try {
    // 2b. Index for file uploads by public_id (for fast lookup)
    await queryInterface.addIndex("files_upload", ["public_id"], {
      name: "idx_file_uploads_public_id",
      unique: true,
      using: "BTREE",
    });
    // logging removed
  } catch (error) {
    // logging removed
  }

  try {
    // 2c. Index for messages by conversation and created date (most important!)
    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
        ON messages(conversation_id, "createdAt" DESC);
      `);
    // logging removed
  } catch (error) {
    // logging removed
  }

  try {
    // 3. Index for pinned messages (partial index)
    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_pinned 
        ON messages(conversation_id, pinned, "createdAt" DESC)
        WHERE pinned = true;
      `);
    // logging removed
  } catch (error) {
    // logging removed
  }

  try {
    // 4. Index for refresh tokens by token value (for fast lookup)
    await queryInterface.addIndex("refresh_tokens", ["token"], {
      name: "idx_refresh_tokens_token",
      using: "HASH",
    });
    // logging removed
  } catch (error) {
    // logging removed
  }

  try {
    // 5. Index for refresh tokens by user (for cleanup)
    await queryInterface.addIndex("refresh_tokens", ["user_id", "revoked"], {
      name: "idx_refresh_tokens_user_revoked",
      using: "BTREE",
    });
    // logging removed
  } catch (error) {
    // logging removed
  }

  try {
    // 6. Index for conversations by project and order
    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_project_order 
        ON conversations(project_id, order_in_project)
        WHERE project_id IS NOT NULL;
      `);
    // logging removed
  } catch (error) {
    // logging removed
  }

  try {
    // 7. GIN Index for conversations tags (for array search performance)
    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_tags 
        ON conversations USING GIN(tags);
      `);
    // logging removed
  } catch (error) {
    // logging removed
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
      // logging removed
    } else {
      // logging removed
    }
  } catch (error) {
    // logging removed
  }

  // logging removed
}

export async function down(queryInterface, Sequelize) {
  // logging removed

  // Remove all added indexes (ignore errors if they don't exist)
  try {
    await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_conversations_tags;");
  } catch (e) {}

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
    await queryInterface.sequelize.query("DROP INDEX IF EXISTS idx_messages_conversation_created;");
  } catch (e) {}

  try {
    await queryInterface.removeIndex("file_uploads", "idx_file_uploads_public_id");
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

  // logging removed
}
