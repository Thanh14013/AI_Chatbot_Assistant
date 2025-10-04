import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();

//configure middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//port
const PORT = process.env.PORT || 3000;

//open connection
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
