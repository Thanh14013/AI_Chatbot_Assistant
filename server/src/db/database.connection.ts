import sequelize from "./database.config.js";

//function to test database connection
const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    // if connection is successful
    console.log("Database connection established successfully.");
  } catch (error) {
    // if connection fails
    console.error("Unable to connect to the database:", error);
  }
};

export default connectToDatabase;
