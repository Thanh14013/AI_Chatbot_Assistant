import { DataTypes, Model, Op } from "sequelize";
import sequelize from "../db/database.config.js";
import User from "./user.model.js";
// RefreshToken Model Class
// Extends Sequelize Model with custom methods for token management
class RefreshToken extends Model {
    // Find a refresh token by its token string
    static async findByToken(token) {
        return RefreshToken.findOne({
            where: { token },
            include: [{ model: User, as: "user" }],
        });
    }
    // Find all valid (non-revoked, non-expired) tokens for a user
    static async findValidTokensByUserId(userId) {
        return RefreshToken.findAll({
            where: {
                user_id: userId,
                is_revoked: false,
                expires_at: {
                    [Op.gt]: new Date(), // Not expired
                },
            },
        });
    }
    // Revoke a specific token
    static async revokeToken(tokenId) {
        const token = await RefreshToken.findByPk(tokenId);
        if (token) {
            token.is_revoked = true;
            await token.save();
            return token;
        }
        return null;
    }
    // Revoke all tokens for a specific user (useful for logout all devices)
    static async revokeAllUserTokens(userId) {
        const [affectedCount] = await RefreshToken.update({ is_revoked: true }, {
            where: {
                user_id: userId,
                is_revoked: false,
            },
        });
        return affectedCount;
    }
    // Delete expired tokens (cleanup utility)
    static async deleteExpiredTokens() {
        return RefreshToken.destroy({
            where: {
                expires_at: {
                    [Op.lt]: new Date(), // Expired
                },
            },
        });
    }
    // Check if a token is valid (not revoked and not expired)
    isValid() {
        return !this.is_revoked && this.expires_at > new Date();
    }
}
// Initialize RefreshToken model with schema definition
RefreshToken.init({
    // Primary key
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: "Unique identifier for the refresh token",
    },
    // Foreign key to User
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
    // Token string (should be hashed)
    token: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
        comment: "Refresh token string (hashed)",
    },
    // Expiration timestamp
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: "Token expiration date and time",
    },
    // Revocation flag
    is_revoked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Whether the token has been revoked",
    },
}, {
    sequelize, // Database connection instance
    tableName: "refresh_tokens",
    modelName: "RefreshToken",
    timestamps: true, // Enable createdAt and updatedAt
    indexes: [
        // Indexes for performance optimization
        { fields: ["user_id"] },
        { fields: ["token"], unique: true },
        { fields: ["expires_at"] },
        { fields: ["user_id", "is_revoked"] },
    ],
});
export default RefreshToken;
