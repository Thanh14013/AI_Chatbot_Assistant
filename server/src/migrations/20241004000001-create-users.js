"use strict";

export default {
  // Run the migration - Create users table
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      // Primary key - UUID type
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: "Unique identifier for the user",
      },

      // User's full name
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "Full name of the user",
      },

      // User's email - unique and indexed
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: "Email address (unique)",
      },

      // Hashed password
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "Hashed password (bcrypt)",
      },

      // Timestamp when user was created
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record creation timestamp",
      },

      // Timestamp when user was last updated
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Record last update timestamp",
      },
    });

    // Create index on email for faster lookups
    await queryInterface.addIndex("users", ["email"], {
      name: "users_email_index",
      unique: true,
    });
  },

  // Reverse the migration - Drop users table
  async down(queryInterface, Sequelize) {
    // Drop the users table and all its data
    await queryInterface.dropTable("users");
  },
};
