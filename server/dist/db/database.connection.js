import sequelize from "./database.config.js";
// Test database connection
const connectToDatabase = async () => {
    try {
        // Attempt to authenticate with the database
        await sequelize.authenticate();
        // Database connected successfully (log suppressed)
    }
    catch (error) {
        // Connection error - print minimal message and exit
        try {
            const msg = error instanceof Error ? error.message : String(error);
            // Use console.warn to emit minimal info without stack
            console.warn("Unable to connect to the database:", msg);
        }
        catch {
            console.warn("Unable to connect to the database");
        }
        process.exit(1);
    }
};
export default connectToDatabase;
