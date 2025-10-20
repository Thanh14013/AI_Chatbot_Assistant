"use strict";

export default {
  // Run the migration - Create user_preferences table
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_preferences", {
      // Primary key - UUID type
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: "Unique identifier for the user preference record",
      },

      // Foreign key to users table
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "Reference to the user who owns these preferences",
      },

      // Language preference
      language: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: "en",
        comment: "Preferred language code (e.g., 'en', 'vi', 'es')",
      },

      // Response style preference
      response_style: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "balanced",
        comment:
          "AI response style (e.g., 'concise', 'detailed', 'balanced', 'casual', 'professional')",
      },

      // Custom instructions for AI
      custom_instructions: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Custom instructions to be included in AI system prompt",
      },

      // Timestamp when preferences were created
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record creation timestamp",
      },

      // Timestamp when preferences were last updated
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record last update timestamp",
      },
    });

    // Create index on user_id for faster lookups
    await queryInterface.addIndex("user_preferences", ["user_id"], {
      name: "user_preferences_user_id_index",
      unique: true,
    });
  },

  // Reverse the migration - Drop user_preferences table
  async down(queryInterface, Sequelize) {
    // Drop the user_preferences table and all its data
    await queryInterface.dropTable("user_preferences");
  },
};
