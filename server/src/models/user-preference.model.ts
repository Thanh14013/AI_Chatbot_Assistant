import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../db/database.config.js";
import User from "./user.model.js";
import type { IUserPreference } from "../types/user-preference.type.js";

// Define UserPreference attributes (excluding timestamps)
type UserPreferenceAttributes = Omit<IUserPreference, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

// Define creation attributes
type UserPreferenceCreationAttributes = Optional<
  UserPreferenceAttributes,
  "id" | "createdAt" | "updatedAt" | "custom_instructions"
>;

/**
 * UserPreference Model Class
 * Manages user preferences for AI interactions
 */
class UserPreference
  extends Model<UserPreferenceAttributes, UserPreferenceCreationAttributes>
  implements UserPreferenceAttributes
{
  // Model properties
  public id!: string;
  public user_id!: string;
  public language!: string;
  public response_style!: string;
  public custom_instructions!: string | null;

  // Timestamps (automatically managed by Sequelize)
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Find preferences by user ID
   */
  public static async findByUserId(userId: string): Promise<UserPreference | null> {
    return UserPreference.findOne({ where: { user_id: userId } });
  }

  /**
   * Create or update preferences for a user
   */
  public static async upsertPreferences(
    userId: string,
    preferences: {
      language?: string;
      response_style?: string;
      custom_instructions?: string | null;
    }
  ): Promise<UserPreference> {
    const [userPreference, created] = await UserPreference.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        language: preferences.language || "en",
        response_style: preferences.response_style || "balanced",
        custom_instructions: preferences.custom_instructions || null,
      },
    });

    if (!created) {
      // Update existing preferences
      if (preferences.language !== undefined) {
        userPreference.language = preferences.language;
      }
      if (preferences.response_style !== undefined) {
        userPreference.response_style = preferences.response_style;
      }
      if (preferences.custom_instructions !== undefined) {
        userPreference.custom_instructions = preferences.custom_instructions;
      }
      await userPreference.save();
    }

    return userPreference;
  }
}

// Initialize UserPreference model with schema definition
UserPreference.init(
  {
    // Primary key - UUID type
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: "Unique identifier for the user preference record",
    },

    // Foreign key to users table
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: "users",
        key: "id",
      },
      comment: "Reference to the user who owns these preferences",
    },

    // Language preference
    language: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "en",
      validate: {
        isIn: [["en", "vi", "es", "fr", "de", "ja", "ko", "zh"]],
      },
      comment: "Preferred language code",
    },

    // Response style preference
    response_style: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "balanced",
      validate: {
        isIn: [["concise", "detailed", "balanced", "casual", "professional"]],
      },
      comment: "AI response style preference",
    },

    // Custom instructions
    custom_instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Custom instructions for AI system prompt",
    },
  },
  {
    sequelize,
    tableName: "user_preferences",
    modelName: "UserPreference",
    timestamps: true,
    indexes: [
      {
        fields: ["user_id"],
        unique: true,
      },
    ],
  }
);

// Define associations
UserPreference.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

User.hasOne(UserPreference, {
  foreignKey: "user_id",
  as: "preferences",
});

export default UserPreference;
