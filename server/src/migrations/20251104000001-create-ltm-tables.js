"use strict";

/**
 * Migration: Create Long Term Memory (LTM) tables
 * This migration creates:
 * 1. user_memory_events - Stores important events and interactions
 * 2. user_conversation_summary - Stores conversation summaries for context
 */
export default {
  // Run the migration - Create LTM tables
  async up(queryInterface, Sequelize) {
    // First, enable pgvector extension for embeddings
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);

    // Create user_memory_events table
    await queryInterface.createTable("user_memory_events", {
      // Primary key - UUID type
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: "Unique identifier for the memory event",
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

      // Event metadata
      event_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: "Type of event: question, problem, learning, preference, etc.",
      },

      // Foreign key to conversations table (nullable if event spans multiple conversations)
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "conversations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "Conversation ID (foreign key, nullable)",
      },

      // Event content
      summary: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "Short summary of the event (max 500 chars recommended)",
      },

      content: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Full content/context of the event (optional)",
      },

      keywords: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: [],
        comment: "Keywords for searching (array of strings)",
      },

      // Note: embedding will be added via raw SQL after table creation
      // because Sequelize doesn't support VECTOR type natively

      // Context and metadata
      context: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: "Additional context data (JSON object)",
      },

      importance_score: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: "Importance score 1-10 (10 = critical, 5 = normal, 1 = trivial)",
      },

      // Timestamps and access tracking
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Event creation timestamp",
      },

      accessed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Last time this event was retrieved",
      },

      access_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Number of times this event was accessed",
      },
    });

    // Add embedding column using raw SQL (VECTOR type)
    await queryInterface.sequelize.query(`
      ALTER TABLE user_memory_events 
      ADD COLUMN embedding VECTOR(1536);
    `);

    // Add comment to embedding column
    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN user_memory_events.embedding IS 'OpenAI embedding vector for semantic search';
    `);

    // Create indexes for user_memory_events
    await queryInterface.addIndex("user_memory_events", ["user_id"], {
      name: "idx_user_events_user_id",
    });

    await queryInterface.addIndex("user_memory_events", ["conversation_id"], {
      name: "idx_user_events_conversation_id",
    });

    await queryInterface.addIndex("user_memory_events", ["created_at"], {
      name: "idx_user_events_created_at",
      using: "BTREE",
      order: [["created_at", "DESC"]],
    });

    await queryInterface.addIndex("user_memory_events", ["importance_score"], {
      name: "idx_user_events_importance",
      using: "BTREE",
      order: [["importance_score", "DESC"]],
    });

    // Create GIN index for keywords array (for fast array operations)
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_user_events_keywords 
      ON user_memory_events USING GIN(keywords);
    `);

    // Create IVFFlat index for embedding (for fast vector similarity search)
    // Note: This requires some data in the table, so we'll create it but allow failures
    try {
      await queryInterface.sequelize.query(`
      CREATE INDEX idx_user_events_embedding 
      ON user_memory_events 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
      `);
    } catch (error) {
      // logging removed
    }

    // Create user_conversation_summary table
    await queryInterface.createTable("user_conversation_summary", {
      // Primary key - UUID type
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: "Unique identifier for the conversation summary",
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

      // Summary content
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "Brief title for the conversation",
      },

      summary: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "Summary of the conversation content",
      },

      key_topics: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: [],
        comment: "Key topics discussed (array of strings)",
      },

      technical_topics: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: [],
        comment: "Technical topics/technologies mentioned (array of strings)",
      },

      // Outcome tracking
      outcome: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: "Outcome of conversation: resolved, ongoing, needs_followup",
      },

      followup_suggestions: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true,
        defaultValue: [],
        comment: "Suggested follow-up questions or topics",
      },

      // Stats
      message_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Number of messages in the conversation",
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Summary creation timestamp",
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Summary last update timestamp",
      },
    });

    // Add unique constraint on conversation_id (one summary per conversation)
    await queryInterface.addConstraint("user_conversation_summary", {
      fields: ["conversation_id"],
      type: "unique",
      name: "unique_conversation_summary",
    });

    // Create indexes for user_conversation_summary
    await queryInterface.addIndex("user_conversation_summary", ["user_id"], {
      name: "idx_conv_summary_user",
    });

    await queryInterface.addIndex("user_conversation_summary", ["updated_at"], {
      name: "idx_conv_summary_updated",
      using: "BTREE",
      order: [["updated_at", "DESC"]],
    });

    // Create GIN index for key_topics array
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_conv_summary_topics 
      ON user_conversation_summary USING GIN(key_topics);
    `);

    // Create GIN index for technical_topics array
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_conv_summary_technical_topics 
      ON user_conversation_summary USING GIN(technical_topics);
    `);

    // logging removed
  },

  // Reverse the migration - Drop LTM tables
  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order (to handle foreign key constraints)
    await queryInterface.dropTable("user_conversation_summary");
    await queryInterface.dropTable("user_memory_events");

    // logging removed
  },
};
