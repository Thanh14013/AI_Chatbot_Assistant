import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized: false,
        }
        : undefined,
});
pool.on("error", (_err) => {
    process.exit(-1);
});
export default pool;
