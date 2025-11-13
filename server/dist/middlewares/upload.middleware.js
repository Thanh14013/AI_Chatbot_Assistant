import multer from "multer";
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error("Invalid file type. Only JPG, PNG, and WebP images are allowed."));
    }
};
export const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});
export const uploadSingle = uploadMiddleware.single("avatar");
export default uploadMiddleware;
