import sequelize from "../db/database.config.js";
import User from "./user.model.js";
import RefreshToken from "./refresh-token.model.js";

// Define Model Relationships

// User has many RefreshTokens (one-to-many relationship)
User.hasMany(RefreshToken, {
  foreignKey: "user_id",
  as: "refreshTokens", // Alias for accessing tokens from user instance
  onDelete: "CASCADE", // Delete all tokens when user is deleted
  onUpdate: "CASCADE",
});

// RefreshToken belongs to User (many-to-one relationship)
RefreshToken.belongsTo(User, {
  foreignKey: "user_id",
  as: "user", // Alias for accessing user from token instance
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Sync all models with database
export const syncDatabase = async (force: boolean = false): Promise<void> => {
  try {
    // force: true will drop tables and recreate them (DANGEROUS - data loss!)
    // force: false will create tables only if they don't exist
    await sequelize.sync({ force, alter: !force });
    console.log("Database synchronized successfully");
  } catch (error) {
    console.error("Error synchronizing database:", error);
    throw error;
  }
};

// Export all models
export default {
  sequelize,
  User,
  RefreshToken,
  syncDatabase,
};
