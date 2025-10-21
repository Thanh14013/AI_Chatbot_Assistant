"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("files_upload", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      public_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      secure_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      resource_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: "image, video, raw (for pdf/docx/csv)",
      },
      format: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      original_filename: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      size_bytes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      width: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      height: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      duration: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: "for videos",
      },
      pages: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "for PDFs",
      },
      uploaded_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "conversations",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      message_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "messages",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      extracted_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "extracted text from PDFs/DOCX/CSV for RAG",
      },
      thumbnail_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "uploaded",
        comment: "uploaded, processing, processed, failed",
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "additional metadata from Cloudinary",
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Create indexes
    await queryInterface.addIndex("files_upload", ["message_id"], {
      name: "idx_files_upload_message_id",
    });
    await queryInterface.addIndex("files_upload", ["conversation_id"], {
      name: "idx_files_upload_conversation_id",
    });
    await queryInterface.addIndex("files_upload", ["uploaded_by"], {
      name: "idx_files_upload_uploaded_by",
    });
    await queryInterface.addIndex("files_upload", ["public_id"], {
      name: "idx_files_upload_public_id",
    });
    await queryInterface.addIndex("files_upload", ["created_at"], {
      name: "idx_files_upload_created_at",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("files_upload");
  },
};
