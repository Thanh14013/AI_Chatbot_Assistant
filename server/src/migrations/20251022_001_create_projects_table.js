"use strict";

export default {
  // Run the migration - Create projects table
  async up(queryInterface, Sequelize) {
    // Enable UUID extension if not already enabled
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Create projects table
    await queryInterface.createTable("projects", {
      // Primary key - UUID type
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: "Unique identifier for the project",
      },

      // User ID - foreign key to users table
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        comment: "User ID (foreign key to users table)",
      },

      // Project name
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "Project name",
      },

      // Project description
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Project description",
      },

      // Color for visual identification
      color: {
        type: Sequelize.STRING(7),
        allowNull: false,
        defaultValue: "#1890ff",
        comment: "Hex color for visual identification",
      },

      // Optional emoji or icon
      icon: {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: "Optional emoji or icon",
      },

      // Display order
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Display order",
      },

      // Timestamp when project was created
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record creation timestamp",
      },

      // Timestamp when project was last updated
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record last update timestamp",
      },

      // Soft delete timestamp
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Soft delete timestamp",
      },
    });

    // Create indexes for performance
    await queryInterface.addIndex("projects", ["user_id"], {
      name: "idx_projects_user_id",
    });

    await queryInterface.addIndex("projects", ["user_id", "order"], {
      name: "idx_projects_user_order",
    });

    await queryInterface.addIndex("projects", ["deleted_at"], {
      name: "idx_projects_deleted",
    });

    // Add table comment
    await queryInterface.sequelize.query(
      "COMMENT ON TABLE projects IS 'Projects for organizing conversations into groups';"
    );
  },

  // Reverse the migration - Drop projects table
  async down(queryInterface, Sequelize) {
    // Drop the projects table and all its data
    await queryInterface.dropTable("projects");
  },
};
