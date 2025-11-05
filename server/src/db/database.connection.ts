import sequelize from "./database.config.js";

// Test database connection
const connectToDatabase = async (): Promise<void> => {
  try {
    // Attempt to authenticate with the database
    await sequelize.authenticate();

    // Database connected successfully (log suppressed)
  } catch (error) {
    // Connection error - print minimal message and exit
    process.exit(1);
  }
};

export default connectToDatabase;
