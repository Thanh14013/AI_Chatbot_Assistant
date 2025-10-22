/**
 * Cloudinary Service
 * Handles avatar upload, deletion, file uploads, and image transformations
 */

import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from "cloudinary";
import crypto from "crypto";

// Type definitions for file uploads
export interface CloudinarySignatureParams {
  timestamp: number;
  signature: string;
  api_key: string;
  cloud_name: string;
  folder?: string;
  resource_type?: string;
  access_mode?: string;
  upload_preset?: string;
}

export interface CloudinaryUploadResponse {
  public_id: string;
  version: number;
  signature: string;
  width?: number;
  height?: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  folder?: string;
  original_filename?: string;
  api_key: string;
  pages?: number;
  duration?: number;
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const CLOUDINARY_FOLDER = "chatbot-avatars";
const CLOUDINARY_UPLOADS_FOLDER = "chatbot-uploads";

/**
 * Upload avatar to Cloudinary
 * @param fileBuffer - Image file buffer from multer
 * @param userId - User ID (used as public_id)
 * @returns Cloudinary secure URL
 */
export const uploadAvatar = async (fileBuffer: Buffer, userId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        public_id: `avatar_${userId}`,
        transformation: [
          {
            width: 500,
            height: 500,
            crop: "fill",
            gravity: "face", // Smart crop focusing on face
          },
          {
            quality: "auto", // Auto optimize quality
          },
          {
            fetch_format: "auto", // Auto format (WebP if supported)
          },
        ],
        overwrite: true, // Replace existing avatar
        invalidate: true, // Invalidate CDN cache
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error("Upload failed: No result returned"));
        }
      }
    );

    // Write buffer to upload stream
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete avatar from Cloudinary
 * @param avatarUrl - Full Cloudinary URL
 */
export const deleteAvatar = async (avatarUrl: string): Promise<void> => {
  try {
    const publicId = extractPublicId(avatarUrl);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    throw new Error(
      `Failed to delete avatar: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Extract public_id from Cloudinary URL
 * Example: https://res.cloudinary.com/.../chatbot-avatars/avatar_123.jpg
 * Returns: chatbot-avatars/avatar_123
 */
const extractPublicId = (url: string): string | null => {
  try {
    // Match pattern: folder/filename without extension
    const match = url.match(/\/([^\/]+\/[^\/]+)\.(jpg|png|webp|jpeg)$/);
    if (match && match[1]) {
      return match[1];
    }

    // Fallback: try to extract from upload path
    const uploadMatch = url.match(/\/upload\/(?:v\d+\/)?(.+)\.(jpg|png|webp|jpeg)$/);
    if (uploadMatch && uploadMatch[1]) {
      return uploadMatch[1];
    }

    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Get avatar URL or return default
 * @param avatarUrl - User's avatar URL
 * @returns Avatar URL or default placeholder
 */
export const getAvatarUrl = (avatarUrl: string | null): string => {
  if (avatarUrl) {
    return avatarUrl;
  }
  // Return default avatar (you can customize this)
  return `https://ui-avatars.com/api/?name=User&background=4F46E5&color=fff&size=500`;
};

export default {
  uploadAvatar,
  deleteAvatar,
  getAvatarUrl,
};

/**
 * ==============================================
 * FILE UPLOAD SERVICE (for chat attachments)
 * ==============================================
 */

/**
 * Generate presigned upload signature for client-side upload
 * This is more secure than exposing API credentials to client
 */
export const generateUploadSignature = (folder?: string): CloudinarySignatureParams => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const uploadFolder = folder || CLOUDINARY_UPLOADS_FOLDER;

  // Parameters to sign - DO NOT include resource_type when using /auto/upload endpoint
  // because Cloudinary auto-detects it and doesn't expect it in the signature
  const paramsToSign: Record<string, any> = {
    timestamp,
    folder: uploadFolder,
    access_mode: "public", // Ensure public access for all uploaded files
  };

  // Generate signature
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
    // Do NOT return resource_type for /auto/upload endpoint
    access_mode: "public", // Return so client knows what was signed
  };
};

/**
 * Generate signature for Cloudinary upload
 */
const generateSignature = (params: Record<string, any>): string => {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const apiSecret = process.env.CLOUDINARY_SECRET_KEY;
  if (!apiSecret) {
    throw new Error("Cloudinary API secret not configured");
  }

  // Create signature using SHA1
  const signature = crypto
    .createHash("sha1")
    .update(sortedParams + apiSecret)
    .digest("hex");

  return signature;
};

/**
 * Upload file directly from server (alternative method)
 */
export const uploadFile = async (
  file: Express.Multer.File | Buffer | string,
  options: {
    folder?: string;
    resource_type?: "image" | "video" | "raw" | "auto";
    public_id?: string;
    format?: string;
  } = {}
): Promise<CloudinaryUploadResponse> => {
  try {
    const uploadOptions = {
      folder: options.folder || CLOUDINARY_UPLOADS_FOLDER,
      resource_type: options.resource_type || "auto",
      public_id: options.public_id,
      format: options.format,
    };

    let uploadPromise;

    if (typeof file === "string") {
      // Upload from URL or base64
      uploadPromise = cloudinary.uploader.upload(file, uploadOptions as any);
    } else if (Buffer.isBuffer(file)) {
      // Upload from buffer
      uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions as any,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(file);
      });
    } else {
      // Upload from file path (multer file)
      uploadPromise = cloudinary.uploader.upload(file.path, uploadOptions as any);
    }

    const result = await uploadPromise;
    return result as CloudinaryUploadResponse;
  } catch (error: any) {
    throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
  }
};

/**
 * Delete file from Cloudinary
 */
export const deleteFile = async (
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error: any) {
    throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
  }
};

/**
 * Generate thumbnail URL for images/videos
 */
export const generateThumbnailUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: string;
    format?: string;
  } = {}
): string => {
  const { width = 200, height = 200, crop = "fill", format = "jpg" } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    format,
    secure: true,
  });
};

/**
 * Get file info from Cloudinary
 */
export const getFileInfo = async (
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
): Promise<any> => {
  try {
    const result = await cloudinary.api.resource(publicId, { resource_type: resourceType });
    return result;
  } catch (error: any) {
    throw new Error(`Failed to get file info from Cloudinary: ${error.message}`);
  }
};

/**
 * Validate file type and size
 */
export const validateFile = (file: Express.Multer.File): { valid: boolean; error?: string } => {
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || "10485760"); // 10MB default

  // Check file size
  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxFileSize / 1024 / 1024}MB`,
    };
  }

  // Check file format
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

/**
 * Determine resource type based on file extension
 */
export const getResourceType = (filename: string): "image" | "video" | "raw" => {
  const extension = filename.split(".").pop()?.toLowerCase();

  const allowedFormats = {
    image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"],
    video: ["mp4", "mov", "avi", "mkv", "webm"],
  };

  if (allowedFormats.image.includes(extension || "")) {
    return "image";
  } else if (allowedFormats.video.includes(extension || "")) {
    return "video";
  } else {
    return "raw";
  }
};
