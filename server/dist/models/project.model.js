import { DataTypes, Model } from "sequelize";
import sequelize from "../db/database.config.js";
/**
 * Project Model Class
 * Represents a project that groups multiple conversations
 */
class Project extends Model {
    /**
     * Find all active projects for a user
     * @param userId - The user's ID
     * @returns Promise with array of projects
     */
    static async findByUserId(userId) {
        return Project.findAll({
            where: {
                user_id: userId,
                deleted_at: null,
            },
            order: [
                ["order", "ASC"],
                ["createdAt", "DESC"],
            ],
        });
    }
    /**
     * Find a specific project by ID (only if not deleted)
     * @param projectId - The project's ID
     * @returns Promise with project or null
     */
    static async findByIdActive(projectId) {
        return Project.findOne({
            where: {
                id: projectId,
                deleted_at: null,
            },
        });
    }
    /**
     * Soft delete a project
     * @param projectId - The project's ID
     * @returns Promise with deleted project or null
     */
    static async softDelete(projectId) {
        const project = await Project.findByPk(projectId);
        if (project) {
            project.deleted_at = new Date();
            await project.save();
            return project;
        }
        return null;
    }
    /**
     * Update order for multiple projects
     * @param updates - Array of {id, order} objects
     */
    static async updateOrders(updates) {
        const promises = updates.map(({ id, order }) => Project.update({ order }, { where: { id } }));
        await Promise.all(promises);
    }
}
// Initialize Project model
Project.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: "Unique identifier for the project",
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
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Project name",
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        comment: "Project description",
    },
    color: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: "#1890ff",
        comment: "Hex color for visual identification",
    },
    icon: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: null,
        comment: "Optional emoji or icon",
    },
    order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Display order",
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        comment: "Soft delete timestamp",
    },
}, {
    sequelize,
    tableName: "projects",
    modelName: "Project",
    timestamps: true,
    paranoid: false,
    underscored: true, // Use snake_case for timestamps (created_at, updated_at)
    indexes: [
        { fields: ["user_id"] },
        { fields: ["user_id", "order"] },
        { fields: ["deleted_at"] },
    ],
});
export default Project;
