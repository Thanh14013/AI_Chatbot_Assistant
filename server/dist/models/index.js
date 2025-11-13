import sequelize from "../db/database.config.js";
import User from "./user.model.js";
import RefreshToken from "./refresh-token.model.js";
import Conversation from "./conversation.model.js";
import Message from "./message.model.js";
import MessageEmbedding from "./message-embedding.model.js";
import UserPreference from "./user-preference.model.js";
User.hasMany(RefreshToken, {
    foreignKey: "user_id",
    as: "refreshTokens",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
RefreshToken.belongsTo(User, {
    foreignKey: "user_id",
    as: "user",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
User.hasMany(Conversation, {
    foreignKey: "user_id",
    as: "conversations",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
Conversation.belongsTo(User, {
    foreignKey: "user_id",
    as: "user",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
Conversation.hasMany(Message, {
    foreignKey: "conversation_id",
    as: "messages",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
Message.belongsTo(Conversation, {
    foreignKey: "conversation_id",
    as: "conversation",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
Message.hasOne(MessageEmbedding, {
    foreignKey: "message_id",
    as: "embedding",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
MessageEmbedding.belongsTo(Message, {
    foreignKey: "message_id",
    as: "message",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
export const syncDatabase = async (force = false) => {
    try {
        await sequelize.sync({ force, alter: !force });
    }
    catch (error) {
        throw error;
    }
};
export default {
    sequelize,
    User,
    RefreshToken,
    Conversation,
    Message,
    MessageEmbedding,
    UserPreference,
    syncDatabase,
};
