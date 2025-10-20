/**
 * Cloudinary Service
 * Handles avatar upload, deletion, and image transformations
 */

import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const CLOUDINARY_FOLDER = "chatbot-avatars";

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
