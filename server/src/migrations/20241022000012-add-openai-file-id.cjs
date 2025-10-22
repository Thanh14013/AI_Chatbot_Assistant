"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add openai_file_id column to files_upload table
    await queryInterface.addColumn("files_upload", "openai_file_id", {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: "OpenAI File API ID for file access in chat completions",
    });

    // Create index for openai_file_id for faster lookups
    await queryInterface.addIndex("files_upload", ["openai_file_id"], {
      name: "idx_files_upload_openai_file_id",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex("files_upload", "idx_files_upload_openai_file_id");

    // Remove column
    await queryInterface.removeColumn("files_upload", "openai_file_id");
  },
};