import { DataTypes, Model, Op } from "sequelize";
import sequelize from "../db/database.config.js";
//User Model Class
//Extends Sequelize Model with custom methods for user management
class User extends Model {
    // Find a user by their email address
    static async findByEmail(email) {
        return User.findOne({ where: { email } });
    }
    // Find a user by their username
    static async findByUsername(username) {
        return User.findOne({ where: { username } });
    }
}
// Initialize User model with schema definition
User.init({
    // Primary key - UUID type
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4, // Auto-generated UUID
        primaryKey: true,
        comment: "Unique identifier for the user",
    },
    // User's full name
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Full name of the user",
    },
    // User's email address (unique)
    email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
        comment: "Email address (unique)",
    },
    // Hashed password (never store plain text)
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Hashed password (bcrypt)",
    },
    // Username (optional, unique)
    username: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: true,
        validate: {
            len: {
                args: [3, 50],
                msg: "Username must be between 3 and 50 characters",
            },
        },
        comment: "Username (unique, optional)",
    },
    // Bio (short description)
    bio: {
        type: DataTypes.STRING(200),
        allowNull: true,
        validate: {
            len: {
                args: [0, 200],
                msg: "Bio must not exceed 200 characters",
            },
        },
        comment: "Short bio or tagline (max 200 chars)",
    },
    // Avatar URL (Cloudinary)
    avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: "Cloudinary avatar URL",
    },
}, {
    sequelize, // Database connection instance
    tableName: "users",
    modelName: "User",
    timestamps: true, // Enable createdAt and updatedAt
    indexes: [
        // Indexes for performance optimization
        { fields: ["email"], unique: true },
        { fields: ["username"], unique: true, where: { username: { [Op.ne]: null } } },
    ],
});
export default User;
