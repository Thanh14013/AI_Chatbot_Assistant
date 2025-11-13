import { DataTypes, Model, Op } from "sequelize";
import sequelize from "../db/database.config.js";
import User from "./user.model.js";
class RefreshToken extends Model {
    static async findByToken(token) {
        return RefreshToken.findOne({
            where: { token },
            include: [{ model: User, as: "user" }],
        });
    }
    static async findValidTokensByUserId(userId) {
        return RefreshToken.findAll({
            where: {
                user_id: userId,
                is_revoked: false,
                expires_at: {
                    [Op.gt]: new Date(),
                },
            },
        });
    }
    static async revokeToken(tokenId) {
        const token = await RefreshToken.findByPk(tokenId);
        if (token) {
            token.is_revoked = true;
            await token.save();
            return token;
        }
        return null;
    }
    static async revokeAllUserTokens(userId) {
        const [affectedCount] = await RefreshToken.update({ is_revoked: true }, {
            where: {
                user_id: userId,
                is_revoked: false,
            },
        });
        return affectedCount;
    }
    static async deleteExpiredTokens() {
        return RefreshToken.destroy({
            where: {
                expires_at: {
                    [Op.lt]: new Date(),
                },
            },
        });
    }
    isValid() {
        return !this.is_revoked && this.expires_at > new Date();
    }
}
RefreshToken.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: "Unique identifier for the refresh token",
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
    token: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
        comment: "Refresh token string (hashed)",
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: "Token expiration date and time",
    },
    is_revoked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Whether the token has been revoked",
    },
}, {
    sequelize,
    tableName: "refresh_tokens",
    modelName: "RefreshToken",
    timestamps: true,
    indexes: [
        { fields: ["user_id"] },
        { fields: ["token"], unique: true },
        { fields: ["expires_at"] },
        { fields: ["user_id", "is_revoked"] },
    ],
});
export default RefreshToken;
