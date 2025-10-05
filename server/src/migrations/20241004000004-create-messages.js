"use strict";

/**
 * Migration: Create messages table
 * This migration creates the messages table with proper indexes
 * for optimal query performance
 */
export default {
  // Run the migration - Create messages table
  async up(queryInterface, Sequelize) {
    // Create messages table
    await queryInterface.createTable("messages", {
      // Primary key - UUID type
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: "Unique identifier for the message",
      },

      // Foreign key to conversations table
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "conversations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "Conversation ID (foreign key to conversations table)",
      },

      // Message role (user, assistant, or system)
      role: {
        type: Sequelize.ENUM("user", "assistant", "system"),
        allowNull: false,
        comment: "Role of the message sender (user, assistant, or system)",
      },

      // Message content/text
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "Message content/text",
      },

      // Number of tokens used in this message
      tokens_used: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Number of tokens consumed by this message",
      },

      // AI model used for this message
      model: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "gpt-3.5-turbo",
        comment: "AI model used for this message",
      },

      // Timestamp when message was created
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Message creation timestamp",
      },
    });

    // Create indexes for performance optimization

    // Index on conversation_id for finding conversation's messages
    await queryInterface.addIndex("messages", ["conversation_id"], {
      name: "messages_conversation_id_index",
    });

    // Composite index on conversation_id and createdAt for chronological queries
    // This is the most important index for retrieving messages in order
    await queryInterface.addIndex("messages", ["conversation_id", "createdAt"], {
      name: "messages_conversation_id_created_at_index",
    });

    // Index on createdAt for sorting messages by creation date
    await queryInterface.addIndex("messages", ["createdAt"], {
      name: "messages_created_at_index",
    });

    // Index on role for filtering messages by role (e.g., only user messages)
    await queryInterface.addIndex("messages", ["role"], {
      name: "messages_role_index",
    });
  },

  // Reverse the migration - Drop messages table
  async down(queryInterface, Sequelize) {
    // Drop the messages table and all its data
    await queryInterface.dropTable("messages");
  },
};
