import sequelize from "../db/database.config.js";
import User from "./user.model.js";
import RefreshToken from "./refresh-token.model.js";
import Conversation from "./conversation.model.js";
import Message from "./message.model.js";
// ============================================================================
// Define Model Relationships
// ============================================================================
// ----------------------------------------------------------------------------
// User <-> RefreshToken Relationships
// ----------------------------------------------------------------------------
// User has many RefreshTokens (one-to-many relationship)
User.hasMany(RefreshToken, {
    foreignKey: "user_id",
    as: "refreshTokens", // Alias for accessing tokens from user instance
    onDelete: "CASCADE", // Delete all tokens when user is deleted
    onUpdate: "CASCADE",
});
// RefreshToken belongs to User (many-to-one relationship)
RefreshToken.belongsTo(User, {
    foreignKey: "user_id",
    as: "user", // Alias for accessing user from token instance
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
// ----------------------------------------------------------------------------
// User <-> Conversation Relationships
// ----------------------------------------------------------------------------
// User has many Conversations (one-to-many relationship)
User.hasMany(Conversation, {
    foreignKey: "user_id",
    as: "conversations", // Alias for accessing conversations from user instance
    onDelete: "CASCADE", // Delete all conversations when user is deleted
    onUpdate: "CASCADE",
});
// Conversation belongs to User (many-to-one relationship)
Conversation.belongsTo(User, {
    foreignKey: "user_id",
    as: "user", // Alias for accessing user from conversation instance
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
// ----------------------------------------------------------------------------
// Conversation <-> Message Relationships
// ----------------------------------------------------------------------------
// Conversation has many Messages (one-to-many relationship)
Conversation.hasMany(Message, {
    foreignKey: "conversation_id",
    as: "messages", // Alias for accessing messages from conversation instance
    onDelete: "CASCADE", // Delete all messages when conversation is deleted
    onUpdate: "CASCADE",
});
// Message belongs to Conversation (many-to-one relationship)
Message.belongsTo(Conversation, {
    foreignKey: "conversation_id",
    as: "conversation", // Alias for accessing conversation from message instance
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
});
// ============================================================================
// Database Synchronization
// ============================================================================
/**
 * Sync all models with database
 * @param force - If true, drops and recreates tables (DANGEROUS - data loss!)
 *                If false, creates tables only if they don't exist
 */
export const syncDatabase = async (force = false) => {
    try {
        // force: true will drop tables and recreate them (DANGEROUS - data loss!)
        // force: false will create tables only if they don't exist
        await sequelize.sync({ force, alter: !force });
        // Database synchronized (log suppressed)
    }
    catch (error) {
        // Log only a concise message to avoid verbose stack traces in normal dev output
        try {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn("Database synchronization failed:", msg);
        }
        catch {
            console.warn("Database synchronization failed");
        }
        // Re-throw so callers can decide how to handle (we keep behavior unchanged)
        throw error;
    }
};
// ============================================================================
// Export all models
// ============================================================================
export default {
    sequelize,
    User,
    RefreshToken,
    Conversation,
    Message,
    syncDatabase,
};
