import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;

//check if DB_URL is defined
if (!DB_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

//config sequelize instance
const sequelize = new Sequelize(DB_URL, {
  dialect: "postgres",
  logging: false,
});

export default sequelize;
