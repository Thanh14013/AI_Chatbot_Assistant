/**
 * File Upload Controller
 * Handles file upload operations, signature generation, and metadata storage
 */

import { Request, Response } from "express";
import * as CloudinaryService from "../services/cloudinary.service.js";
import * as FileProcessorService from "../services/fileProcessor.service.js";
import * as OpenAIFileService from "../services/openai-file.service.js";
import { extractTextFromPDF } from "../services/pdf-parser.service.js";
import FileUploadModel, { FileUploadMetadata } from "../models/fileUpload.model.js";

// Security: Allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/jpg",
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
];

// Security: Allowed file extensions
const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".csv",
];

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Generate presigned upload signature for client
 * POST /api/files/upload-signature
 */
export const generateUploadSignature = async (req: Request, res: Response) => {
  try {
    const { folder, filename, fileSize, fileType } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate file size
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return res.status(413).json({
        success: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }

    // Validate file type
    if (fileType && !ALLOWED_MIME_TYPES.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: "File type not allowed. Allowed types: images, videos, PDF, DOC, DOCX, TXT, CSV",
      });
    }

    // Validate file extension
    if (filename) {
      const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({
          success: false,
          error: `File extension not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(", ")}`,
        });
      }
    }

    const signature = CloudinaryService.generateUploadSignature(folder);

    res.json({
      success: true,
      data: signature,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate upload signature",
    });
  }
};

/**
 * Save file metadata after successful upload to Cloudinary
 * POST /api/files/metadata
 */
export const saveFileMetadata = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      public_id,
      secure_url,
      resource_type,
      format,
      original_filename,
      size_bytes,
      width,
      height,
      duration,
      pages,
      conversation_id,
      metadata,
    } = req.body;

    // Validate required fields
    if (!public_id || !secure_url || !resource_type) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: public_id, secure_url, resource_type",
      });
    }

    // Validate file size
    if (size_bytes && size_bytes > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }

    // Validate file type (extension)
    if (format) {
      const ext = `.${format.toLowerCase()}`;
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({
          success: false,
          error: "File extension not allowed",
        });
      }
    }

    // Generate thumbnail for images/videos
    let thumbnail_url;
    if (resource_type === "image" || resource_type === "video") {
      thumbnail_url = CloudinaryService.generateThumbnailUrl(public_id);
    }

    // Process file to extract text (for documents)
    let extracted_text;
    let processing_pages;
    let status: "uploaded" | "processing" | "processed" | "failed" = "uploaded";

    // Extract text from PDF files
    if (format === "pdf") {
      status = "processing";

      try {
        extracted_text = await extractTextFromPDF(secure_url);
        status = "processed";

        // Check if extraction actually worked
        if (extracted_text && extracted_text.startsWith("[")) {
          // PDF extraction returned error message
        }
      } catch (error: any) {
        status = "failed";
        extracted_text = "[PDF text extraction failed]";
      }
    } else if (resource_type === "raw" && format) {
      // Fallback to old processor for other document types
      status = "processing";
      const processingResult = await FileProcessorService.processFile(
        secure_url,
        resource_type,
        format
      );

      if (processingResult.error) {
        status = "failed";
      } else {
        extracted_text = processingResult.extracted_text;
        processing_pages = processingResult.pages;
        status = "processed";
      }
    }

    // Upload to OpenAI File API if supported
    let openai_file_id;
    if (OpenAIFileService.isFileSupportedByOpenAI(resource_type, format)) {
      // Check if file already exists in our database with OpenAI file_id
      const existingFile = await FileUploadModel.findByPublicId(public_id);
      if (existingFile?.openai_file_id) {
        openai_file_id = existingFile.openai_file_id;
      } else {
        // Check if file already exists in OpenAI by filename
        const existingOpenAIFileId = await OpenAIFileService.getExistingOpenAIFile(
          original_filename || public_id,
          userId
        );

        if (existingOpenAIFileId) {
          openai_file_id = existingOpenAIFileId;
        } else {
          // Upload to OpenAI File API
          const openaiResult = await OpenAIFileService.uploadFileToOpenAI(
            secure_url,
            original_filename || public_id,
            resource_type,
            format
          );

          if (openaiResult.success && openaiResult.file_id) {
            openai_file_id = openaiResult.file_id;
          } else {
            // Continue without OpenAI file_id - don't fail the whole operation
          }
        }
      }
    }

    // Save to database
    const fileData: Omit<FileUploadMetadata, "id" | "created_at" | "updated_at"> = {
      public_id,
      secure_url,
      resource_type,
      format,
      original_filename,
      size_bytes,
      width,
      height,
      duration,
      pages: pages || processing_pages,
      uploaded_by: userId,
      conversation_id,
      extracted_text,
      thumbnail_url,
      status,
      metadata,
      openai_file_id,
    };

    const savedFile = await FileUploadModel.create(fileData);

    res.json({
      success: true,
      data: savedFile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to save file metadata",
    });
  }
};

/**
 * Get file by ID
 * GET /api/files/:id
 */
export const getFileById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const fileId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = await FileUploadModel.findById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    // Check if user owns the file
    if (file.uploaded_by !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    res.json({
      success: true,
      data: file,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get file",
    });
  }
};

/**
 * Get files for a conversation
 * GET /api/files/conversation/:conversationId
 */
export const getConversationFiles = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const conversationId = req.params.conversationId; // UUID string

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify user has access to this conversation
    const { default: Conversation } = await import("../models/conversation.model.js");
    const conversation = await Conversation.findByPk(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    if (conversation.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this conversation",
      });
    }

    const files = await FileUploadModel.findByConversationId(conversationId);

    res.json({
      success: true,
      data: files,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get conversation files",
    });
  }
};

/**
 * Delete file
 * DELETE /api/files/:id
 */
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const fileId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = await FileUploadModel.findById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    // Check if user owns the file
    if (file.uploaded_by !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Delete from Cloudinary
    try {
      await CloudinaryService.deleteFile(file.public_id, file.resource_type);
    } catch (error) {
      // Continue with DB deletion even if Cloudinary fails
    }

    // Delete from OpenAI if file_id exists
    if (file.openai_file_id) {
      try {
        await OpenAIFileService.deleteOpenAIFile(file.openai_file_id);
      } catch (error) {
        // Continue with DB deletion even if OpenAI deletion fails
      }
    }

    // Delete from database
    await FileUploadModel.delete(fileId);

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete file",
    });
  }
};

/**
 * Get user's upload statistics
 * GET /api/files/stats
 */
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const stats = await FileUploadModel.getUserStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get upload statistics",
    });
  }
};
