/**
 * Migration: Add Missing Performance Indexes
 * Adds indexes that were missed in the previous migration
 * Created: 2025-11-03
 */

export async function up(queryInterface, Sequelize) {
  // logging removed

  // Fix refresh_tokens index - use correct column name 'is_revoked' instead of 'revoked'
  try {
    await queryInterface.addIndex("refresh_tokens", ["user_id", "is_revoked"], {
      name: "idx_refresh_tokens_user_is_revoked",
      using: "BTREE",
    });
    // logging removed
  } catch (error) {
    // logging removed
  }

  // Check if message_embeddings table exists and add index
  try {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_embeddings';",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (tables.length > 0) {
      // Check what columns exist in message_embeddings
      const columns = await queryInterface.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'message_embeddings' AND table_schema = 'public';",
        { type: Sequelize.QueryTypes.SELECT }
      );

      // logging removed

      // Try different possible column names
      const possibleColumns = ["conversation_id", "conversationId", "message_id", "messageId"];
      let indexAdded = false;

      for (const colName of possibleColumns) {
        if (columns.some((c) => c.column_name === colName)) {
          try {
            await queryInterface.addIndex("message_embeddings", [colName], {
              name: `idx_message_embeddings_${colName.toLowerCase()}`,
              using: "BTREE",
            });
            // logging removed
            indexAdded = true;
            break;
          } catch (error) {
            // logging removed
          }
        }
      }

      if (!indexAdded) {
        // logging removed
      }
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

  // Remove the indexes we added
  try {
    await queryInterface.removeIndex("refresh_tokens", "idx_refresh_tokens_user_is_revoked");
    // logging removed
  } catch (e) {
    // logging removed
  }

  // Try to remove message_embeddings indexes
  try {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_embeddings';",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (tables.length > 0) {
      const possibleIndexNames = [
        "idx_message_embeddings_conversation_id",
        "idx_message_embeddings_conversationid",
        "idx_message_embeddings_message_id",
        "idx_message_embeddings_messageid",
      ];

      for (const indexName of possibleIndexNames) {
        try {
          await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexName};`);
        } catch (e) {
          // Ignore errors
        }
      }
      // logging removed
    }
  } catch (e) {
    // logging removed
  }

  // logging removed
}
