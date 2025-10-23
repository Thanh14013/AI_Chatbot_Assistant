/**
 * File Upload Controller
 * Handles file upload operations, signature generation, and metadata storage
 */
import * as CloudinaryService from "../services/cloudinary.service.js";
import * as FileProcessorService from "../services/fileProcessor.service.js";
import * as OpenAIFileService from "../services/openai-file.service.js";
import { extractTextFromPDF } from "../services/pdf-parser.service.js";
import FileUploadModel from "../models/fileUpload.model.js";
/**
 * Generate presigned upload signature for client
 * POST /api/files/upload-signature
 */
export const generateUploadSignature = async (req, res) => {
    try {
        const { folder } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const signature = CloudinaryService.generateUploadSignature(folder);
        res.json({
            success: true,
            data: signature,
        });
    }
    catch (error) {
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
export const saveFileMetadata = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { public_id, secure_url, resource_type, format, original_filename, size_bytes, width, height, duration, pages, conversation_id, metadata, } = req.body;
        // Validate required fields
        if (!public_id || !secure_url || !resource_type) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: public_id, secure_url, resource_type",
            });
        }
        // Generate thumbnail for images/videos
        let thumbnail_url;
        if (resource_type === "image" || resource_type === "video") {
            thumbnail_url = CloudinaryService.generateThumbnailUrl(public_id);
        }
        // Process file to extract text (for documents)
        let extracted_text;
        let processing_pages;
        let status = "uploaded";
        // Extract text from PDF files
        if (format === "pdf") {
            console.log("📄 [FileUpload Controller] Detected PDF file, extracting text...");
            status = "processing";
            try {
                extracted_text = await extractTextFromPDF(secure_url);
                status = "processed";
                console.log("✅ [FileUpload Controller] PDF text extraction completed", {
                    textLength: extracted_text?.length || 0,
                    textPreview: extracted_text?.substring(0, 100) +
                        (extracted_text && extracted_text.length > 100 ? "..." : ""),
                });
            }
            catch (error) {
                console.error("❌ [FileUpload Controller] PDF text extraction failed", {
                    error: error?.message,
                });
                status = "failed";
                extracted_text = "[PDF text extraction failed]";
            }
        }
        else if (resource_type === "raw" && format) {
            // Fallback to old processor for other document types
            status = "processing";
            const processingResult = await FileProcessorService.processFile(secure_url, resource_type, format);
            if (processingResult.error) {
                status = "failed";
            }
            else {
                extracted_text = processingResult.extracted_text;
                processing_pages = processingResult.pages;
                status = "processed";
            }
        }
        // Upload to OpenAI File API if supported
        let openai_file_id;
        if (OpenAIFileService.isFileSupportedByOpenAI(resource_type, format)) {
            console.log("🤖 [FileUpload Controller] File supported by OpenAI, checking for existing file_id");
            // Check if file already exists in our database with OpenAI file_id
            const existingFile = await FileUploadModel.findByPublicId(public_id);
            if (existingFile?.openai_file_id) {
                console.log("✅ [FileUpload Controller] Using existing OpenAI file_id", {
                    public_id,
                    openai_file_id: existingFile.openai_file_id,
                });
                openai_file_id = existingFile.openai_file_id;
            }
            else {
                // Check if file already exists in OpenAI by filename
                const existingOpenAIFileId = await OpenAIFileService.getExistingOpenAIFile(original_filename || public_id, userId);
                if (existingOpenAIFileId) {
                    console.log("✅ [FileUpload Controller] Found existing OpenAI file", {
                        filename: original_filename,
                        openai_file_id: existingOpenAIFileId,
                    });
                    openai_file_id = existingOpenAIFileId;
                }
                else {
                    // Upload to OpenAI File API
                    console.log("📤 [FileUpload Controller] Uploading to OpenAI File API");
                    const openaiResult = await OpenAIFileService.uploadFileToOpenAI(secure_url, original_filename || public_id, resource_type, format);
                    if (openaiResult.success && openaiResult.file_id) {
                        console.log("✅ [FileUpload Controller] Successfully uploaded to OpenAI", {
                            file_id: openaiResult.file_id,
                        });
                        openai_file_id = openaiResult.file_id;
                    }
                    else {
                        console.warn("⚠️ [FileUpload Controller] Failed to upload to OpenAI", {
                            error: openaiResult.error,
                        });
                        // Continue without OpenAI file_id - don't fail the whole operation
                    }
                }
            }
        }
        else {
            console.log("ℹ️ [FileUpload Controller] File type not supported by OpenAI File API", {
                resource_type,
                format,
            });
        }
        // Save to database
        const fileData = {
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
    }
    catch (error) {
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
export const getFileById = async (req, res) => {
    try {
        const userId = req.user?.id;
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
    }
    catch (error) {
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
export const getConversationFiles = async (req, res) => {
    try {
        const userId = req.user?.id;
        const conversationId = req.params.conversationId; // UUID string
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // TODO: Verify user has access to this conversation
        const files = await FileUploadModel.findByConversationId(conversationId);
        res.json({
            success: true,
            data: files,
        });
    }
    catch (error) {
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
export const deleteFile = async (req, res) => {
    try {
        const userId = req.user?.id;
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
        }
        catch (error) {
            // Continue with DB deletion even if Cloudinary fails
        }
        // Delete from OpenAI if file_id exists
        if (file.openai_file_id) {
            try {
                console.log("🗑️ [FileUpload Controller] Deleting from OpenAI File API", {
                    file_id: file.openai_file_id,
                });
                await OpenAIFileService.deleteOpenAIFile(file.openai_file_id);
            }
            catch (error) {
                console.warn("⚠️ [FileUpload Controller] Failed to delete from OpenAI", {
                    file_id: file.openai_file_id,
                    error: error.message,
                });
                // Continue with DB deletion even if OpenAI deletion fails
            }
        }
        // Delete from database
        await FileUploadModel.delete(fileId);
        res.json({
            success: true,
            message: "File deleted successfully",
        });
    }
    catch (error) {
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
export const getUserStats = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const stats = await FileUploadModel.getUserStats(userId);
        res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || "Failed to get upload statistics",
        });
    }
};
