/**
 * File Upload Service
 * Handles file uploads to Cloudinary and metadata storage
 */

import axiosInstance from "./axios.service";
import type {
  FileAttachment,
  CloudinarySignature,
  CloudinaryUploadResponse,
} from "../types/file.types";

export const fileUploadService = {
  /**
   * Get presigned upload signature from server
   */
  async getUploadSignature(folder?: string): Promise<CloudinarySignature> {
    const response = await axiosInstance.post("/files/upload-signature", {
      folder,
    });
    return response.data.data;
  },

  /**
   * Upload file directly to Cloudinary using presigned signature
   */
  async uploadToCloudinary(
    file: File,
    signature: CloudinarySignature,
    onProgress?: (progress: number) => void
  ): Promise<CloudinaryUploadResponse> {
    console.log(
      "📥 Received signature from server:",
      JSON.stringify(signature, null, 2)
    );

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signature.api_key);
    formData.append("timestamp", signature.timestamp.toString());
    formData.append("signature", signature.signature);
    formData.append("folder", signature.folder);

    // Add signed params (MUST match what server signed)
    // NOTE: Do NOT send resource_type for /auto/upload endpoint - it auto-detects!

    if (signature.access_mode) {
      console.log("✅ Appending access_mode:", signature.access_mode);
      formData.append("access_mode", signature.access_mode);
    } else {
      console.error("❌ Missing access_mode in signature!");
    }

    // Debug: log all FormData entries
    const entries: string[] = [];
    formData.forEach((value, key) => {
      entries.push(`${key}=${value}`);
    });
    console.log("📤 FormData entries:", entries.join(", "));

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            reject(new Error("Failed to parse Cloudinary response"));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(
              new Error(
                `Upload failed: ${
                  errorResponse.error?.message || xhr.statusText
                }`
              )
            );
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      // Use /auto/upload endpoint for auto-detect resource type
      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${signature.cloud_name}/auto/upload`
      );
      xhr.send(formData);
    });
  },

  /**
   * Save file metadata to server database
   */
  async saveFileMetadata(metadata: {
    public_id: string;
    secure_url: string;
    resource_type: string;
    format?: string;
    original_filename?: string;
    size_bytes?: number;
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
    conversation_id?: string;
  }): Promise<FileAttachment> {
    const response = await axiosInstance.post("/files/metadata", metadata);
    return response.data.data;
  },

  /**
   * Get file by ID
   */
  async getFileById(fileId: number): Promise<FileAttachment> {
    const response = await axiosInstance.get(`/files/${fileId}`);
    return response.data.data;
  },

  /**
   * Get all files for a conversation
   */
  async getConversationFiles(
    conversationId: string
  ): Promise<FileAttachment[]> {
    const response = await axiosInstance.get(
      `/files/conversation/${conversationId}`
    );
    return response.data.data;
  },

  /**
   * Delete file
   */
  async deleteFile(fileId: number): Promise<void> {
    await axiosInstance.delete(`/files/${fileId}`);
  },

  /**
   * Get user's upload statistics
   */
  async getUserStats(): Promise<{
    total_files: number;
    total_size_bytes: number;
    file_types: Record<string, number>;
  }> {
    const response = await axiosInstance.get("/files/stats");
    return response.data.data;
  },

  /**
   * Complete upload flow: get signature, upload, save metadata
   */
  async uploadFile(
    file: File,
    options?: {
      conversation_id?: string;
      onProgress?: (progress: number) => void;
    }
  ): Promise<FileAttachment> {
    try {
      // Step 1: Get presigned signature
      const signature = await this.getUploadSignature();

      // Step 2: Upload to Cloudinary with progress tracking
      const uploadProgress = (progress: number) => {
        if (options?.onProgress) {
          // Reserve 0-90% for upload, 90-100% for processing
          options.onProgress(Math.min(progress * 0.9, 90));
        }
      };

      const cloudinaryResponse = await this.uploadToCloudinary(
        file,
        signature,
        uploadProgress
      );

      // Step 3: Save metadata to database
      if (options?.onProgress) {
        options.onProgress(95);
      }

      const metadata: {
        public_id: string;
        secure_url: string;
        resource_type: string;
        format?: string;
        original_filename?: string;
        size_bytes?: number;
        width?: number;
        height?: number;
        duration?: number;
        pages?: number;
        conversation_id?: string;
      } = {
        public_id: cloudinaryResponse.public_id,
        secure_url: cloudinaryResponse.secure_url,
        resource_type: cloudinaryResponse.resource_type,
        format: cloudinaryResponse.format,
        original_filename: file.name,
        size_bytes: cloudinaryResponse.bytes,
        width: cloudinaryResponse.width,
        height: cloudinaryResponse.height,
        duration: cloudinaryResponse.duration,
        pages: cloudinaryResponse.pages,
        conversation_id: options?.conversation_id,
      };

      const savedFile = await this.saveFileMetadata(metadata);

      if (options?.onProgress) {
        options.onProgress(100);
      }

      return savedFile;
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  },

  /**
   * Validate file before upload
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    // Maximum file size: 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${
          maxSize / (1024 * 1024)
        }MB`,
      };
    }

    // Allowed file types
    const allowedTypes = [
      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/bmp",
      // Videos
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/webm",
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type "${file.type}" is not supported`,
      };
    }

    return { valid: true };
  },
};

export default fileUploadService;
