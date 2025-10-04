import { DataTypes, Model, Optional, Op } from "sequelize";
import sequelize from "../db/database.config.js";
import type { IRefreshToken } from "../types/refresh-token.type.js";
import User from "./user.model.js";

// Define RefreshToken attributes
type RefreshTokenAttributes = Omit<IRefreshToken, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

// Define creation attributes (fields that can be omitted when creating)
type RefreshTokenCreationAttributes = Optional<
  RefreshTokenAttributes,
  "id" | "createdAt" | "updatedAt" | "is_revoked"
>;

// RefreshToken Model Class
// Extends Sequelize Model with custom methods for token management
class RefreshToken
  extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes>
  implements RefreshTokenAttributes
{
  // Model properties
  public id!: string;
  public user_id!: string;
  public token!: string;
  public expires_at!: Date;
  public is_revoked!: boolean;

  // Timestamps (managed by Sequelize)
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Find a refresh token by its token string
  public static async findByToken(token: string): Promise<RefreshToken | null> {
    return RefreshToken.findOne({
      where: { token },
      include: [{ model: User, as: "user" }],
    });
  }

  // Find all valid (non-revoked, non-expired) tokens for a user
  public static async findValidTokensByUserId(userId: string): Promise<RefreshToken[]> {
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
  public static async revokeToken(tokenId: string): Promise<RefreshToken | null> {
    const token = await RefreshToken.findByPk(tokenId);
    if (token) {
      token.is_revoked = true;
      await token.save();
      return token;
    }
    return null;
  }

  // Revoke all tokens for a specific user (useful for logout all devices)
  public static async revokeAllUserTokens(userId: string): Promise<number> {
    const [affectedCount] = await RefreshToken.update(
      { is_revoked: true },
      {
        where: {
          user_id: userId,
          is_revoked: false,
        },
      }
    );
    return affectedCount;
  }

  // Delete expired tokens (cleanup utility)
  public static async deleteExpiredTokens(): Promise<number> {
    return RefreshToken.destroy({
      where: {
        expires_at: {
          [Op.lt]: new Date(), // Expired
        },
      },
    });
  }

  // Check if a token is valid (not revoked and not expired)
  public isValid(): boolean {
    return !this.is_revoked && this.expires_at > new Date();
  }
}

// Initialize RefreshToken model with schema definition
RefreshToken.init(
  {
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
  },
  {
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
  }
);

export default RefreshToken;
