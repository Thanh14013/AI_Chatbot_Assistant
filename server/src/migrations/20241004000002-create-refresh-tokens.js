"use strict";

export default {
  // Run the migration - Create refresh_tokens table
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("refresh_tokens", {
      // Primary key - UUID type
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: "Unique identifier for the refresh token",
      },

      // Foreign key to users table
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users", // References the users table
          key: "id",
        },
        onUpdate: "CASCADE", // Update token if user id changes
        onDelete: "CASCADE", // Delete all tokens if user is deleted
        comment: "User ID (foreign key to users table)",
      },

      // The actual refresh token (should be hashed in production)
      token: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
        comment: "Refresh token string (hashed)",
      },

      // Token expiration timestamp
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: "Token expiration date and time",
      },

      // Whether the token has been revoked (for logout, security, etc.)
      is_revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Whether the token has been revoked",
      },

      // Timestamp when token was created
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record creation timestamp",
      },

      // Timestamp when token was last updated
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record last update timestamp",
      },
    });

    // Create index on user_id for faster lookups of all tokens for a user
    await queryInterface.addIndex("refresh_tokens", ["user_id"], {
      name: "refresh_tokens_user_id_index",
    });

    // Create index on token for faster token validation
    await queryInterface.addIndex("refresh_tokens", ["token"], {
      name: "refresh_tokens_token_index",
      unique: true,
    });

    // Create index on expires_at for efficient cleanup of expired tokens
    await queryInterface.addIndex("refresh_tokens", ["expires_at"], {
      name: "refresh_tokens_expires_at_index",
    });

    // Composite index for common query pattern (user_id + is_revoked)
    await queryInterface.addIndex("refresh_tokens", ["user_id", "is_revoked"], {
      name: "refresh_tokens_user_revoked_index",
    });
  },

  // Reverse the migration - Drop refresh_tokens table
  async down(queryInterface, Sequelize) {
    // Drop the refresh_tokens table and all its data
    await queryInterface.dropTable("refresh_tokens");
  },
};
