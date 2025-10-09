import { DataTypes, Model } from "sequelize";
import sequelize from "../db/database.config.js";
/**
 * Message Model Class
 * Represents a single message in a conversation
 * Can be from user, assistant (AI), or system
 * Extends Sequelize Model with custom methods for message management
 */
class Message extends Model {
    /**
     * Find all messages for a specific conversation
     * @param conversationId - The conversation's ID
     * @param limit - Optional limit for number of messages
     * @returns Promise with array of messages ordered by creation time
     */
    static async findByConversationId(conversationId, limit) {
        return Message.findAll({
            where: { conversation_id: conversationId },
            order: [["createdAt", "ASC"]], // Oldest first (chronological order)
            limit: limit || undefined,
        });
    }
    /**
     * Find the last N messages for a conversation (for context window)
     * @param conversationId - The conversation's ID
     * @param limit - Number of recent messages to retrieve
     * @returns Promise with array of recent messages in chronological order
     */
    static async findRecentMessages(conversationId, limit) {
        const messages = await Message.findAll({
            where: { conversation_id: conversationId },
            order: [["createdAt", "DESC"]], // Most recent first
            limit: limit,
        });
        // Reverse to get chronological order (oldest to newest)
        return messages.reverse();
    }
    /**
     * Count total messages in a conversation
     * @param conversationId - The conversation's ID
     * @returns Promise with message count
     */
    static async countByConversation(conversationId) {
        return Message.count({
            where: { conversation_id: conversationId },
        });
    }
    /**
     * Delete all messages for a conversation (cascade delete)
     * @param conversationId - The conversation's ID
     * @returns Promise with number of deleted messages
     */
    static async deleteByConversation(conversationId) {
        return Message.destroy({
            where: { conversation_id: conversationId },
        });
    }
}
// Initialize Message model with schema definition
Message.init({
    // Primary key - UUID type
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4, // Auto-generated UUID
        primaryKey: true,
        comment: "Unique identifier for the message",
    },
    // Foreign key to conversations table
    conversation_id: {
        type: DataTypes.UUID,
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
        type: DataTypes.ENUM("user", "assistant", "system"),
        allowNull: false,
        comment: "Role of the message sender (user, assistant, or system)",
    },
    // Message content/text
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "Message content/text",
    },
    // Number of tokens used in this message
    tokens_used: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Number of tokens consumed by this message",
    },
    // AI model used for this message
    model: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "gpt-3.5-turbo",
        comment: "AI model used for this message",
    },
}, {
    sequelize, // Database connection instance
    tableName: "messages",
    modelName: "Message",
    timestamps: true, // Enable createdAt
    updatedAt: false, // Messages don't need updatedAt (immutable)
    indexes: [
        // Indexes for performance optimization
        { fields: ["conversation_id"] }, // Index for finding conversation's messages
        { fields: ["conversation_id", "createdAt"] }, // Composite index for chronological queries
        { fields: ["createdAt"] }, // Index for sorting by creation date
        { fields: ["role"] }, // Index for filtering by role
    ],
});
export default Message;
