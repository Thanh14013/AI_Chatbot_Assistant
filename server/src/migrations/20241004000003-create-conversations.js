"use strict";

/**
 * Migration: Create conversations table
 * This migration creates the conversations table with proper indexes
 * for optimal query performance
 */
export default {
  // Run the migration - Create conversations table
  async up(queryInterface, Sequelize) {
    // Create conversations table
    await queryInterface.createTable("conversations", {
      // Primary key - UUID type
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: "Unique identifier for the conversation",
      },

      // Foreign key to users table
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "User ID (foreign key to users table)",
      },

      // Conversation title
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: "New Conversation",
        comment: "Title/name of the conversation",
      },

      // AI model used for this conversation
      model: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "gpt-3.5-turbo",
        comment: "AI model used (e.g., gpt-4, gpt-3.5-turbo)",
      },

      // Number of messages to include in context window
      context_window: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10,
        comment: "Number of messages to include in context",
      },

      // Total tokens consumed in this conversation
      total_tokens_used: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Total tokens consumed in this conversation",
      },

      // Total number of messages in conversation
      message_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Total number of messages in conversation",
      },

      // Soft delete timestamp
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
        comment: "Soft delete timestamp (null if not deleted)",
      },

      // Timestamp when conversation was created
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record creation timestamp",
      },

      // Timestamp when conversation was last updated
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record last update timestamp",
      },
    });

    // Create indexes for performance optimization

    // Index on user_id for finding user's conversations
    await queryInterface.addIndex("conversations", ["user_id"], {
      name: "conversations_user_id_index",
    });

    // Composite index on user_id and deleted_at for finding active conversations
    await queryInterface.addIndex("conversations", ["user_id", "deleted_at"], {
      name: "conversations_user_id_deleted_at_index",
    });

    // Index on createdAt for sorting by creation date
    await queryInterface.addIndex("conversations", ["createdAt"], {
      name: "conversations_created_at_index",
    });

    // Index on updatedAt for sorting by last update (most common query)
    await queryInterface.addIndex("conversations", ["updatedAt"], {
      name: "conversations_updated_at_index",
    });
  },

  // Reverse the migration - Drop conversations table
  async down(queryInterface, Sequelize) {
    // Drop the conversations table and all its data
    await queryInterface.dropTable("conversations");
  },
};
