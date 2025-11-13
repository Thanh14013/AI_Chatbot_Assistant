import { DataTypes, Model } from "sequelize";
import sequelize from "../db/database.config.js";
class Message extends Model {
    static async findByConversationId(conversationId, limit) {
        return Message.findAll({
            where: { conversation_id: conversationId },
            order: [["createdAt", "ASC"]],
            limit: limit || undefined,
        });
    }
    static async findRecentMessages(conversationId, limit) {
        const messages = await Message.findAll({
            where: { conversation_id: conversationId },
            order: [["createdAt", "DESC"]],
            limit: limit,
        });
        return messages.reverse();
    }
    static async countByConversation(conversationId) {
        return Message.count({
            where: { conversation_id: conversationId },
        });
    }
    static async deleteByConversation(conversationId) {
        return Message.destroy({
            where: { conversation_id: conversationId },
        });
    }
    static async pinMessage(messageId) {
        const message = await Message.findByPk(messageId);
        if (!message) {
            throw new Error("Message not found");
        }
        message.pinned = true;
        await message.save();
        return message;
    }
    static async unpinMessage(messageId) {
        const message = await Message.findByPk(messageId);
        if (!message) {
            throw new Error("Message not found");
        }
        message.pinned = false;
        await message.save();
        return message;
    }
    static async findPinnedMessages(conversationId) {
        const messages = await Message.findAll({
            where: {
                conversation_id: conversationId,
                pinned: true,
            },
            order: [["createdAt", "DESC"]],
        });
        return messages;
    }
    static async countPinnedByConversation(conversationId) {
        const count = await Message.count({
            where: {
                conversation_id: conversationId,
                pinned: true,
            },
        });
        return count;
    }
}
Message.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: "Unique identifier for the message",
    },
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
    role: {
        type: DataTypes.ENUM("user", "assistant", "system"),
        allowNull: false,
        comment: "Role of the message sender (user, assistant, or system)",
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "Message content/text",
    },
    tokens_used: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Number of tokens consumed by this message",
    },
    model: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "gpt-3.5-turbo",
        comment: "AI model used for this message",
    },
    pinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Whether the message is pinned for quick reference",
    },
}, {
    sequelize,
    tableName: "messages",
    modelName: "Message",
    timestamps: true,
    updatedAt: false,
    indexes: [
        { fields: ["conversation_id"] },
        { fields: ["conversation_id", "createdAt"] },
        { fields: ["createdAt"] },
        { fields: ["role"] },
        { fields: ["conversation_id", "pinned", "createdAt"] },
    ],
});
export default Message;
