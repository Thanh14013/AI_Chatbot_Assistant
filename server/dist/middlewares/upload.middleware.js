/**
 * Upload Middleware
 * Handles file upload validation using Multer
 */
import multer from "multer";
// Use memory storage (file buffer, not disk)
const storage = multer.memoryStorage();
// File filter: Only accept image files
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true); // Accept file
    }
    else {
        cb(new Error("Invalid file type. Only JPG, PNG, and WebP images are allowed."));
    }
};
// Configure multer
export const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
});
// Single avatar upload
export const uploadSingle = uploadMiddleware.single("avatar");
export default uploadMiddleware;
