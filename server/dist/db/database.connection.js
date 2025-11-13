import sequelize from "./database.config.js";
const connectToDatabase = async () => {
    try {
        await sequelize.authenticate();
    }
    catch (error) {
        process.exit(1);
    }
};
export default connectToDatabase;
