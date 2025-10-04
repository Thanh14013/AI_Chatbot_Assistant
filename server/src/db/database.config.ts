import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const DB_URL = process.env.DATABASE_URL;

// Validate that DATABASE_URL is defined
if (!DB_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

// Create Sequelize instance
// Configures connection to PostgreSQL database
const sequelize = new Sequelize(DB_URL, {
  dialect: "postgres", // Database type
  logging: false, // Disable SQL query logging (set to console.log to see queries)
  pool: {
    // Connection pool configuration for production
    max: 5, // Maximum number of connections
    min: 0, // Minimum number of connections
    acquire: 30000, // Maximum time (ms) to try getting connection
    idle: 10000, // Maximum time (ms) a connection can be idle before being released
  },
});

export default sequelize;
