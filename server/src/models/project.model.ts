import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../db/database.config.js";
import type { IProject } from "../types/project.type.js";

// Define Project attributes
type ProjectAttributes = Omit<IProject, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

// Define creation attributes
type ProjectCreationAttributes = Optional<
  ProjectAttributes,
  "id" | "createdAt" | "updatedAt" | "description" | "color" | "icon" | "order" | "deleted_at"
>;

/**
 * Project Model Class
 * Represents a project that groups multiple conversations
 */
class Project
  extends Model<ProjectAttributes, ProjectCreationAttributes>
  implements ProjectAttributes
{
  // Model properties
  public id!: string;
  public user_id!: string;
  public name!: string;
  public description!: string | null;
  public color!: string;
  public icon!: string | null;
  public order!: number;
  public deleted_at!: Date | null;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Find all active projects for a user
   * @param userId - The user's ID
   * @returns Promise with array of projects
   */
  public static async findByUserId(userId: string): Promise<Project[]> {
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
  public static async findByIdActive(projectId: string): Promise<Project | null> {
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
  public static async softDelete(projectId: string): Promise<Project | null> {
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
  public static async updateOrders(updates: Array<{ id: string; order: number }>): Promise<void> {
    const promises = updates.map(({ id, order }) => Project.update({ order }, { where: { id } }));
    await Promise.all(promises);
  }
}

// Initialize Project model
Project.init(
  {
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
  },
  {
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
  }
);

export default Project;
