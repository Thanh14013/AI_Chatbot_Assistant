"use strict";

export default {
  // Run the migration - Add profile fields to users table
  async up(queryInterface, Sequelize) {
    // Add new columns
    await queryInterface.addColumn("users", "username", {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true,
      comment: "Username (unique, optional)",
    });

    await queryInterface.addColumn("users", "bio", {
      type: Sequelize.STRING(200),
      allowNull: true,
      comment: "Short bio or tagline (max 200 chars)",
    });

    await queryInterface.addColumn("users", "avatar_url", {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: "Cloudinary avatar URL",
    });

    // Create index on username for faster lookups
    await queryInterface.addIndex("users", ["username"], {
      name: "users_username_index",
      unique: true,
      where: {
        username: {
          [Sequelize.Op.ne]: null,
        },
      },
    });

    // Note: updatedAt already exists in the users table from initial migration
    // If you need to add a trigger for auto-updating updatedAt, it's handled by Sequelize
  },

  // Reverse the migration - Remove profile fields
  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex("users", "users_username_index");

    // Remove columns
    await queryInterface.removeColumn("users", "username");
    await queryInterface.removeColumn("users", "bio");
    await queryInterface.removeColumn("users", "avatar_url");
  },
};
