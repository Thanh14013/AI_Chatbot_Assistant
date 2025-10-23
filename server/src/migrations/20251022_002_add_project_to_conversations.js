"use strict";

export default {
  // Run the migration - Add project relationship to conversations
  async up(queryInterface, Sequelize) {
    // Add project_id column
    await queryInterface.addColumn("conversations", "project_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "projects",
        key: "id",
      },
      onDelete: "SET NULL",
      comment: "Project ID (foreign key to projects table, null if not in a project)",
    });

    // Add order_in_project column
    await queryInterface.addColumn("conversations", "order_in_project", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Display order within project",
    });

    // Create indexes for performance
    await queryInterface.addIndex("conversations", ["project_id"], {
      name: "idx_conversations_project",
    });

    await queryInterface.addIndex("conversations", ["project_id", "order_in_project"], {
      name: "idx_conversations_project_order",
    });
  },

  // Reverse the migration - Remove project relationship from conversations
  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex("conversations", "idx_conversations_project_order");
    await queryInterface.removeIndex("conversations", "idx_conversations_project");

    // Remove columns
    await queryInterface.removeColumn("conversations", "order_in_project");
    await queryInterface.removeColumn("conversations", "project_id");
  },
};
