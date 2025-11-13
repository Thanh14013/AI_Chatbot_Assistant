import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables");
}
const sequelize = new Sequelize(DB_URL, {
    dialect: "postgres",
    logging: false,
    pool: {
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000,
    },
    dialectOptions: {
        ssl: process.env.DB_SSL === "true"
            ? {
                require: true,
                rejectUnauthorized: false,
            }
            : false,
    },
});
export default sequelize;
