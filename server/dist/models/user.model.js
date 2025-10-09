import { DataTypes, Model } from "sequelize";
import sequelize from "../db/database.config.js";
//User Model Class
//Extends Sequelize Model with custom methods for user management
class User extends Model {
    // Find a user by their email address
    static async findByEmail(email) {
        return User.findOne({ where: { email } });
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
}, {
    sequelize, // Database connection instance
    tableName: "users",
    modelName: "User",
    timestamps: true, // Enable createdAt and updatedAt
    indexes: [
        // Indexes for performance optimization
        { fields: ["email"], unique: true },
    ],
});
export default User;
