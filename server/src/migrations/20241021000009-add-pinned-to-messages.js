"use strict";
/**
 * Migration: Add pinned column to messages table
 * Date: October 21, 2025
 * Purpose: Allow users to pin important messages for easy reference
 */

export default {
  /**
   * Add pinned column and index to messages table
   */
  up: async (queryInterface, Sequelize) => {
    console.log("📌 [MIGRATION] Starting: Add pinned column to messages table");

    try {
      // Add pinned column
      await queryInterface.addColumn("messages", "pinned", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Whether the message is pinned for quick reference",
      });
      console.log("✅ [MIGRATION] Added pinned column to messages table");

      // Add index for efficient pinned messages queries
      // Index on (conversation_id, pinned, createdAt) for fast retrieval of pinned messages
      await queryInterface.addIndex("messages", ["conversation_id", "pinned", "createdAt"], {
        name: "idx_messages_pinned",
        comment: "Index for efficient pinned messages queries",
      });
      console.log("✅ [MIGRATION] Added index idx_messages_pinned");

      console.log("🎉 [MIGRATION] Completed successfully: Add pinned to messages");
    } catch (error) {
      console.error("❌ [MIGRATION] Failed to add pinned column:", error);
      throw error;
    }
  },

  /**
   * Remove pinned column and index from messages table
   */
  down: async (queryInterface, Sequelize) => {
    console.log("📌 [MIGRATION] Starting rollback: Remove pinned from messages table");

    try {
      // Remove index first
      await queryInterface.removeIndex("messages", "idx_messages_pinned");
      console.log("✅ [MIGRATION] Removed index idx_messages_pinned");

      // Remove pinned column
      await queryInterface.removeColumn("messages", "pinned");
      console.log("✅ [MIGRATION] Removed pinned column from messages table");

      console.log("🎉 [MIGRATION] Rollback completed successfully");
    } catch (error) {
      console.error("❌ [MIGRATION] Rollback failed:", error);
      throw error;
    }
  },
};
