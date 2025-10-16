import { DataTypes, Model } from "sequelize";
import sequelize from "../db/database.config.js";
/**
 * MessageEmbedding Model Class
 * Represents a vector embedding for a message
 * Used for semantic search and contextual intelligence
 */
class MessageEmbedding extends Model {
    /**
     * Find embedding by message ID
     * @param messageId - The message's ID
     * @returns Promise with embedding or null
     */
    static async findByMessageId(messageId) {
        return MessageEmbedding.findOne({
            where: { message_id: messageId },
        });
    }
    /**
     * Check if embedding exists for a message
     * @param messageId - The message's ID
     * @returns Promise with boolean
     */
    static async existsForMessage(messageId) {
        const count = await MessageEmbedding.count({
            where: { message_id: messageId },
        });
        return count > 0;
    }
    /**
     * Batch create embeddings
     * @param embeddings - Array of embedding data
     * @returns Promise with created embeddings
     */
    static async bulkCreateEmbeddings(embeddings) {
        return MessageEmbedding.bulkCreate(embeddings);
    }
    /**
     * Delete embedding by message ID
     * @param messageId - The message's ID
     * @returns Promise with number of deleted rows
     */
    static async deleteByMessageId(messageId) {
        return MessageEmbedding.destroy({
            where: { message_id: messageId },
        });
    }
}
// Initialize MessageEmbedding model with schema definition
MessageEmbedding.init({
    // Primary key - auto-incrementing integer
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        comment: "Auto-incrementing primary key",
    },
    // Foreign key to messages table
    message_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
            model: "messages",
            key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "Foreign key to messages table (one-to-one relationship)",
    },
    // Vector embedding
    // Note: In TypeScript/Sequelize, we treat this as number[] (array)
    // The actual PostgreSQL type is 'vector(1536)' defined in the migration
    embedding: {
        type: DataTypes.ARRAY(DataTypes.REAL), // Array of floats in PostgreSQL
        allowNull: false,
        comment: "1536-dimensional vector embedding from OpenAI",
    },
    // Timestamp
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "created_at",
        comment: "Timestamp when embedding was generated",
    },
}, {
    sequelize,
    tableName: "message_embeddings",
    modelName: "MessageEmbedding",
    timestamps: false, // We manually manage created_at
    indexes: [{ fields: ["message_id"], unique: true }, { fields: ["created_at"] }],
});
export default MessageEmbedding;
