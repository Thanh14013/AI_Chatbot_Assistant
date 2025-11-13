import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
});
const CLOUDINARY_FOLDER = "chatbot-avatars";
const CLOUDINARY_UPLOADS_FOLDER = "chatbot-uploads";
export const uploadAvatar = async (fileBuffer, userId) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({
            folder: CLOUDINARY_FOLDER,
            public_id: `avatar_${userId}`,
            transformation: [
                {
                    width: 500,
                    height: 500,
                    crop: "fill",
                    gravity: "face",
                },
                {
                    quality: "auto",
                },
                {
                    fetch_format: "auto",
                },
            ],
            overwrite: true,
            invalidate: true,
        }, (error, result) => {
            if (error) {
                reject(new Error(`Cloudinary upload failed: ${error.message}`));
            }
            else if (result) {
                resolve(result.secure_url);
            }
            else {
                reject(new Error("Upload failed: No result returned"));
            }
        });
        uploadStream.end(fileBuffer);
    });
};
export const deleteAvatar = async (avatarUrl) => {
    try {
        const publicId = extractPublicId(avatarUrl);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId);
        }
    }
    catch (error) {
        throw new Error(`Failed to delete avatar: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
};
const extractPublicId = (url) => {
    try {
        const match = url.match(/\/([^\/]+\/[^\/]+)\.(jpg|png|webp|jpeg)$/);
        if (match && match[1]) {
            return match[1];
        }
        const uploadMatch = url.match(/\/upload\/(?:v\d+\/)?(.+)\.(jpg|png|webp|jpeg)$/);
        if (uploadMatch && uploadMatch[1]) {
            return uploadMatch[1];
        }
        return null;
    }
    catch (error) {
        return null;
    }
};
export const getAvatarUrl = (avatarUrl) => {
    if (avatarUrl) {
        return avatarUrl;
    }
    return `https://ui-avatars.com/api/?name=User&background=4F46E5&color=fff&size=500`;
};
export default {
    uploadAvatar,
    deleteAvatar,
    getAvatarUrl,
};
export const generateUploadSignature = (folder) => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const uploadFolder = folder || CLOUDINARY_UPLOADS_FOLDER;
    const paramsToSign = {
        timestamp,
        folder: uploadFolder,
        access_mode: "public",
    };
    const signature = generateSignature(paramsToSign);
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.CLOUDINARY_NAME;
    if (!apiKey || !cloudName) {
        throw new Error("Cloudinary configuration missing");
    }
    return {
        timestamp,
        signature,
        api_key: apiKey,
        cloud_name: cloudName,
        folder: uploadFolder,
        access_mode: "public",
    };
};
const generateSignature = (params) => {
    const sortedParams = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");
    const apiSecret = process.env.CLOUDINARY_SECRET_KEY;
    if (!apiSecret) {
        throw new Error("Cloudinary API secret not configured");
    }
    const signature = crypto
        .createHash("sha1")
        .update(sortedParams + apiSecret)
        .digest("hex");
    return signature;
};
export const uploadFile = async (file, options = {}) => {
    try {
        const uploadOptions = {
            folder: options.folder || CLOUDINARY_UPLOADS_FOLDER,
            resource_type: options.resource_type || "auto",
            public_id: options.public_id,
            format: options.format,
        };
        let uploadPromise;
        if (typeof file === "string") {
            uploadPromise = cloudinary.uploader.upload(file, uploadOptions);
        }
        else if (Buffer.isBuffer(file)) {
            uploadPromise = new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                    if (error)
                        reject(error);
                    else
                        resolve(result);
                });
                uploadStream.end(file);
            });
        }
        else {
            uploadPromise = cloudinary.uploader.upload(file.path, uploadOptions);
        }
        const result = await uploadPromise;
        return result;
    }
    catch (error) {
        throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
    }
};
export const deleteFile = async (publicId, resourceType = "image") => {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    }
    catch (error) {
        throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
    }
};
export const generateThumbnailUrl = (publicId, options = {}) => {
    const { width = 200, height = 200, crop = "fill", format = "jpg" } = options;
    return cloudinary.url(publicId, {
        width,
        height,
        crop,
        format,
        secure: true,
    });
};
export const getFileInfo = async (publicId, resourceType = "image") => {
    try {
        const result = await cloudinary.api.resource(publicId, { resource_type: resourceType });
        return result;
    }
    catch (error) {
        throw new Error(`Failed to get file info from Cloudinary: ${error.message}`);
    }
};
export const validateFile = (file) => {
    const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || "10485760");
    if (file.size > maxFileSize) {
        return {
            valid: false,
            error: `File size exceeds maximum allowed size of ${maxFileSize / 1024 / 1024}MB`,
        };
    }
    const fileExtension = file.originalname.split(".").pop()?.toLowerCase();
    if (!fileExtension) {
        return { valid: false, error: "File has no extension" };
    }
    const allowedFormats = {
        image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"],
        video: ["mp4", "mov", "avi", "mkv", "webm"],
        document: ["pdf", "doc", "docx", "txt", "csv", "xls", "xlsx"],
    };
    const allAllowedFormats = [
        ...allowedFormats.image,
        ...allowedFormats.video,
        ...allowedFormats.document,
    ];
    if (!allAllowedFormats.includes(fileExtension)) {
        return {
            valid: false,
            error: `File format .${fileExtension} is not allowed. Allowed formats: ${allAllowedFormats.join(", ")}`,
        };
    }
    return { valid: true };
};
export const getResourceType = (filename) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    const allowedFormats = {
        image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"],
        video: ["mp4", "mov", "avi", "mkv", "webm"],
    };
    if (allowedFormats.image.includes(extension || "")) {
        return "image";
    }
    else if (allowedFormats.video.includes(extension || "")) {
        return "video";
    }
    else {
        return "raw";
    }
};
