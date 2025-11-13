import { DataTypes, Model, Op } from "sequelize";
import sequelize from "../db/database.config.js";
class Conversation extends Model {
    static async findByUserId(userId) {
        return Conversation.findAll({
            where: {
                user_id: userId,
                deleted_at: null,
            },
            order: [["updatedAt", "DESC"]],
        });
    }
    static async findByIdActive(conversationId) {
        return Conversation.findOne({
            where: {
                id: conversationId,
                deleted_at: null,
            },
        });
    }
    static async softDelete(conversationId) {
        const conversation = await Conversation.findByPk(conversationId);
        if (conversation) {
            conversation.deleted_at = new Date();
            await conversation.save();
            return conversation;
        }
        return null;
    }
    async incrementStats(tokensUsed) {
        this.message_count += 1;
        this.total_tokens_used += tokensUsed;
        await this.save();
    }
}
Conversation.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: "Unique identifier for the conversation",
    },
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
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "New Conversation",
        comment: "Title/name of the conversation",
    },
    model: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "gpt-3.5-turbo",
        comment: "AI model used (e.g., gpt-4, gpt-3.5-turbo)",
    },
    context_window: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
        comment: "Number of messages to include in context",
    },
    total_tokens_used: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Total tokens consumed in this conversation",
    },
    message_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Total number of messages in conversation",
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        comment: "Soft delete timestamp (null if not deleted)",
    },
    tags: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: false,
        defaultValue: [],
        comment: "Tags for organizing conversations (max 4 tags, max 20 chars each)",
    },
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
    order_in_project: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Display order within project",
    },
}, {
    sequelize,
    tableName: "conversations",
    modelName: "Conversation",
    timestamps: true,
    paranoid: false,
    defaultScope: {
        where: {
            deleted_at: null,
        },
    },
    scopes: {
        withDeleted: {
            where: {},
        },
        onlyDeleted: {
            where: {
                deleted_at: {
                    [Op.ne]: null,
                },
            },
        },
    },
    indexes: [
        { fields: ["user_id"] },
        { fields: ["user_id", "deleted_at"] },
        { fields: ["project_id"] },
        { fields: ["project_id", "order_in_project"] },
        { fields: ["createdAt"] },
        { fields: ["updatedAt"] },
    ],
});
export default Conversation;
