import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
    secure: true,
});
if (!process.env.CLOUDINARY_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_SECRET_KEY) {
}
export default cloudinary;
export const cloudinaryConfig = {
    cloudName: process.env.CLOUDINARY_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: process.env.CLOUDINARY_FOLDER || "chatbot-uploads",
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
    allowedFormats: {
        image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"],
        video: ["mp4", "mov", "avi", "mkv", "webm"],
        document: ["pdf", "doc", "docx", "txt", "csv", "xls", "xlsx"],
    },
};
