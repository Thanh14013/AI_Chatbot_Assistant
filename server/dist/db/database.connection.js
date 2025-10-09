import sequelize from "./database.config.js";
// Test database connection
const connectToDatabase = async () => {
    try {
        // Attempt to authenticate with the database
        await sequelize.authenticate();
        // Log success message
        console.log("✓ Database connection established successfully.");
    }
    catch (error) {
        // Log error if connection fails
        console.error("✗ Unable to connect to the database:", error);
        // Exit process with failure
        process.exit(1);
    }
};
export default connectToDatabase;
