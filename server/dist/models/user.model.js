import { DataTypes, Model, Op } from "sequelize";
import sequelize from "../db/database.config.js";
class User extends Model {
    static async findByEmail(email) {
        return User.findOne({ where: { email } });
    }
    static async findByUsername(username) {
        return User.findOne({ where: { username } });
    }
}
User.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: "Unique identifier for the user",
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Full name of the user",
    },
    email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
        comment: "Email address (unique)",
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Hashed password (bcrypt)",
    },
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
    avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: "Cloudinary avatar URL",
    },
}, {
    sequelize,
    tableName: "users",
    modelName: "User",
    timestamps: true,
    indexes: [
        { fields: ["email"], unique: true },
        { fields: ["username"], unique: true, where: { username: { [Op.ne]: null } } },
    ],
});
export default User;
