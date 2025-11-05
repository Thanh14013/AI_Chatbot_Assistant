import { DataTypes, Model, Op } from "sequelize";
import sequelize from "../db/database.config.js";
/**
 * Conversation Model Class
 * Represents a chat conversation between a user and the AI assistant
 * Extends Sequelize Model with custom methods for conversation management
 */
class Conversation extends Model {
    /**
     * Find all active (non-deleted) conversations for a user
     * @param userId - The user's ID
     * @returns Promise with array of conversations
     */
    static async findByUserId(userId) {
        return Conversation.findAll({
            where: {
                user_id: userId,
                deleted_at: null, // Only non-deleted conversations
            },
            order: [["updatedAt", "DESC"]], // Most recently updated first
        });
    }
    /**
     * Find a specific conversation by ID (only if not deleted)
     * @param conversationId - The conversation's ID
     * @returns Promise with conversation or null
     */
    static async findByIdActive(conversationId) {
        return Conversation.findOne({
            where: {
                id: conversationId,
                deleted_at: null, // Only if not deleted
            },
        });
    }
    /**
     * Soft delete a conversation (set deleted_at timestamp)
     * @param conversationId - The conversation's ID
     * @returns Promise with deleted conversation or null
     */
    static async softDelete(conversationId) {
        const conversation = await Conversation.findByPk(conversationId);
        if (conversation) {
            conversation.deleted_at = new Date();
            await conversation.save();
            return conversation;
        }
        return null;
    }
    /**
     * Increment message count and total tokens used
     * @param tokensUsed - Number of tokens used in the new message
     */
    async incrementStats(tokensUsed) {
        this.message_count += 1;
        this.total_tokens_used += tokensUsed;
        await this.save();
    }
}
// Initialize Conversation model with schema definition
Conversation.init({
    // Primary key - UUID type
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4, // Auto-generated UUID
        primaryKey: true,
        comment: "Unique identifier for the conversation",
    },
    // Foreign key to users table
    user_id: {
        type: DataTypes.UUID,
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
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "New Conversation",
        comment: "Title/name of the conversation",
    },
    // AI model used for this conversation
    model: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "gpt-3.5-turbo",
        comment: "AI model used (e.g., gpt-4, gpt-3.5-turbo)",
    },
    // Number of messages to include in context window
    context_window: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
        comment: "Number of messages to include in context",
    },
    // Total tokens consumed in this conversation
    total_tokens_used: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Total tokens consumed in this conversation",
    },
    // Total number of messages in conversation
    message_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Total number of messages in conversation",
    },
    // Soft delete timestamp
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        comment: "Soft delete timestamp (null if not deleted)",
    },
    // Tags for organizing conversations
    tags: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: false,
        defaultValue: [],
        comment: "Tags for organizing conversations (max 4 tags, max 20 chars each)",
    },
    // Project relationship
    project_id: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
            model: "projects",
            key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "Project ID (foreign key to projects table, null if not in a project)",
    },
    // Order within project
    order_in_project: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Display order within project",
    },
}, {
    sequelize, // Database connection instance
    tableName: "conversations",
    modelName: "Conversation",
    timestamps: true, // Enable createdAt and updatedAt
    paranoid: false, // We handle soft deletes manually with deleted_at
    defaultScope: {
        // Default scope automatically filters out deleted records
        where: {
            deleted_at: null,
        },
    },
    scopes: {
        // Scope to include deleted records
        withDeleted: {
            where: {},
        },
        // Scope to get only deleted records
        onlyDeleted: {
            where: {
                deleted_at: {
                    [Op.ne]: null,
                },
            },
        },
    },
    indexes: [
        // Indexes for performance optimization
        { fields: ["user_id"] }, // Index for finding user's conversations
        { fields: ["user_id", "deleted_at"] }, // Composite index for active conversations
        { fields: ["project_id"] }, // Index for finding conversations in a project
        { fields: ["project_id", "order_in_project"] }, // Composite index for ordered project conversations
        { fields: ["createdAt"] }, // Index for sorting by creation date
        { fields: ["updatedAt"] }, // Index for sorting by update date
    ],
});
export default Conversation;
