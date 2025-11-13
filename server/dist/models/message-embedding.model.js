import { DataTypes, Model } from "sequelize";
import sequelize from "../db/database.config.js";
class MessageEmbedding extends Model {
    static async findByMessageId(messageId) {
        return MessageEmbedding.findOne({
            where: { message_id: messageId },
        });
    }
    static async existsForMessage(messageId) {
        const count = await MessageEmbedding.count({
            where: { message_id: messageId },
        });
        return count > 0;
    }
    static async bulkCreateEmbeddings(embeddings) {
        return MessageEmbedding.bulkCreate(embeddings);
    }
    static async deleteByMessageId(messageId) {
        return MessageEmbedding.destroy({
            where: { message_id: messageId },
        });
    }
}
MessageEmbedding.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        comment: "Auto-incrementing primary key",
    },
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
    embedding: {
        type: DataTypes.ARRAY(DataTypes.REAL),
        allowNull: false,
        comment: "1536-dimensional vector embedding from OpenAI",
    },
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
    timestamps: false,
    indexes: [{ fields: ["message_id"], unique: true }, { fields: ["created_at"] }],
});
export default MessageEmbedding;
