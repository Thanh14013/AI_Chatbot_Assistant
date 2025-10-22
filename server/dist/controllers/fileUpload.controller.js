/**
 * File Upload Controller
 * Handles file upload operations, signature generation, and metadata storage
 */
import * as CloudinaryService from "../services/cloudinary.service.js";
import * as FileProcessorService from "../services/fileProcessor.service.js";
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
        console.error("Generate signature error:", error);
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
        if (resource_type === "raw" && format) {
            status = "processing";
            const processingResult = await FileProcessorService.processFile(secure_url, resource_type, format);
            if (processingResult.error) {
                console.error("File processing error:", processingResult.error);
                status = "failed";
            }
            else {
                extracted_text = processingResult.extracted_text;
                processing_pages = processingResult.pages;
                status = "processed";
            }
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
        };
        const savedFile = await FileUploadModel.create(fileData);
        res.json({
            success: true,
            data: savedFile,
        });
    }
    catch (error) {
        console.error("Save file metadata error:", error);
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
        console.error("Get file error:", error);
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
        console.error("Get conversation files error:", error);
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
            console.error("Cloudinary delete error:", error);
            // Continue with DB deletion even if Cloudinary fails
        }
        // Delete from database
        await FileUploadModel.delete(fileId);
        res.json({
            success: true,
            message: "File deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete file error:", error);
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
        console.error("Get stats error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to get upload statistics",
        });
    }
};
