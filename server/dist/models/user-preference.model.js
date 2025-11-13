import { DataTypes, Model } from "sequelize";
import sequelize from "../db/database.config.js";
import User from "./user.model.js";
class UserPreference extends Model {
    static async findByUserId(userId) {
        return UserPreference.findOne({ where: { user_id: userId } });
    }
    static async upsertPreferences(userId, preferences) {
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
UserPreference.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: "Unique identifier for the user preference record",
    },
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
    language: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "en",
        validate: {
            isIn: [["en", "vi", "es", "fr", "de", "ja", "ko", "zh"]],
        },
        comment: "Preferred language code",
    },
    response_style: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "balanced",
        validate: {
            isIn: [["concise", "detailed", "balanced", "casual", "professional"]],
        },
        comment: "AI response style preference",
    },
    custom_instructions: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Custom instructions for AI system prompt",
    },
}, {
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
});
UserPreference.belongsTo(User, {
    foreignKey: "user_id",
    as: "user",
});
User.hasOne(UserPreference, {
    foreignKey: "user_id",
    as: "preferences",
});
export default UserPreference;
