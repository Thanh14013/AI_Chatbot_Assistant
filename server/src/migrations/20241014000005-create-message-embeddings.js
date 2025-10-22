"use strict";

/**
 * Migration: Create message_embeddings table with pgvector support
 *
 * This migration:
 * 1. Enables the pgvector extension for vector operations
 * 2. Creates message_embeddings table with VECTOR(1536) type for OpenAI embeddings
 * 3. Creates HNSW index for fast cosine similarity search
 *
 * Prerequisites:
 * - PostgreSQL 11+ with pgvector extension installed
 * - For Supabase: pgvector is pre-installed, no additional setup needed
 * - For local PostgreSQL: Install pgvector extension first
 *   (https://github.com/pgvector/pgvector)
 */
export default {
  // Run the migration - Create message_embeddings table with vector support
  async up(queryInterface, Sequelize) {
    // Step 1: Enable pgvector extension
    // This is safe to run multiple times (IF NOT EXISTS)
    await queryInterface.sequelize.query("CREATE EXTENSION IF NOT EXISTS vector;");

    // Step 2: Create message_embeddings table
    await queryInterface.createTable("message_embeddings", {
      // Primary key - auto-incrementing integer
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
        comment: "Auto-incrementing primary key",
      },

      // Foreign key to messages table
      message_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true, // One embedding per message
        references: {
          model: "messages",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE", // Delete embedding when message is deleted
        comment: "Foreign key to messages table (one-to-one relationship)",
      },

      // Vector embedding - 1536 dimensions for OpenAI text-embedding-3-small
      // NOTE: This uses raw SQL type 'vector(1536)' which requires pgvector extension
      embedding: {
        type: "vector(1536)", // Cannot use Sequelize.DataTypes here - use raw SQL type
        allowNull: false,
        comment: "1536-dimensional vector embedding from OpenAI text-embedding-3-small",
      },

      // Timestamp when embedding was created
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Timestamp when embedding was generated",
      },
    });

    // Step 3: Create standard index on message_id for lookups
    await queryInterface.addIndex("message_embeddings", ["message_id"], {
      name: "message_embeddings_message_id_index",
      unique: true,
    });

    // Step 4: Create HNSW index for fast vector similarity search
    // HNSW (Hierarchical Navigable Small World) is optimized for cosine similarity
    // This dramatically speeds up similarity searches on large datasets
    //
    // Parameters explained:
    // - m: Maximum number of connections per layer (default: 16, range: 4-64)
    //      Higher = better recall but slower builds and more memory
    // - ef_construction: Size of candidate list during index building (default: 64)
    //      Higher = better quality index but slower to build
    //
    // For cosine distance operator (<=>), this enables fast approximate nearest neighbor search
    await queryInterface.sequelize.query(`
      CREATE INDEX message_embeddings_embedding_cosine_idx 
      ON message_embeddings 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);

    // Optional: Create index on created_at for time-based queries
    await queryInterface.addIndex("message_embeddings", ["created_at"], {
      name: "message_embeddings_created_at_index",
    });
  },

  // Reverse the migration - Drop table and disable extension
  async down(queryInterface, Sequelize) {
    // Drop the message_embeddings table (indexes are dropped automatically)
    await queryInterface.dropTable("message_embeddings");

    // Note: We don't drop the vector extension here because other tables might use it
    // If you need to completely remove the extension, run manually:
    // DROP EXTENSION IF EXISTS vector;
  },
};
