"use strict";

/**
 * Migration: Add tags to conversations table
 * Adds a tags column (TEXT array) with GIN index for efficient tag filtering
 */
export default {
  // Run the migration - Add tags column to conversations table
  async up(queryInterface, Sequelize) {
    // Add tags column as TEXT array with default empty array
    await queryInterface.addColumn("conversations", "tags", {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: false,
      defaultValue: [],
      comment: "Tags for organizing conversations (max 4 tags, max 20 chars each)",
    });

    // Create GIN index for efficient tag filtering and searching
    // GIN (Generalized Inverted Index) is perfect for array containment operations
    await queryInterface.addIndex("conversations", ["tags"], {
      name: "idx_conversations_tags",
      using: "GIN",
    });
  },

  // Reverse the migration - Remove tags column and index
  async down(queryInterface, Sequelize) {
    // Remove GIN index first
    await queryInterface.removeIndex("conversations", "idx_conversations_tags");

    // Remove tags column
    await queryInterface.removeColumn("conversations", "tags");
  },
};
