import * as CloudinaryService from "../services/cloudinary.service.js";
import * as FileProcessorService from "../services/fileProcessor.service.js";
import * as OpenAIFileService from "../services/openai-file.service.js";
import { extractTextFromPDF } from "../services/pdf-parser.service.js";
import FileUploadModel from "../models/fileUpload.model.js";
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/jpg",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
];
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
const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const generateUploadSignature = async (req, res) => {
    try {
        const { folder, filename, fileSize, fileType } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (fileSize && fileSize > MAX_FILE_SIZE) {
            return res.status(413).json({
                success: false,
                error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            });
        }
        if (fileType && !ALLOWED_MIME_TYPES.includes(fileType)) {
            return res.status(400).json({
                success: false,
                error: "File type not allowed. Allowed types: images, videos, PDF, DOC, DOCX, TXT, CSV",
            });
        }
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || "Failed to generate upload signature",
        });
    }
};
export const saveFileMetadata = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { public_id, secure_url, resource_type, format, original_filename, size_bytes, width, height, duration, pages, conversation_id, metadata, } = req.body;
        if (!public_id || !secure_url || !resource_type) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: public_id, secure_url, resource_type",
            });
        }
        if (size_bytes && size_bytes > MAX_FILE_SIZE) {
            return res.status(400).json({
                success: false,
                error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            });
        }
        if (format) {
            const ext = `.${format.toLowerCase()}`;
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                return res.status(400).json({
                    success: false,
                    error: "File extension not allowed",
                });
            }
        }
        let thumbnail_url;
        if (resource_type === "image" || resource_type === "video") {
            thumbnail_url = CloudinaryService.generateThumbnailUrl(public_id);
        }
        let extracted_text;
        let processing_pages;
        let status = "uploaded";
        if (format === "pdf") {
            status = "processing";
            try {
                extracted_text = await extractTextFromPDF(secure_url);
                status = "processed";
                if (extracted_text && extracted_text.startsWith("[")) {
                }
            }
            catch (error) {
                status = "failed";
                extracted_text = "[PDF text extraction failed]";
            }
        }
        else if (resource_type === "raw" && format) {
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
        let openai_file_id;
        if (OpenAIFileService.isFileSupportedByOpenAI(resource_type, format)) {
            const existingFile = await FileUploadModel.findByPublicId(public_id);
            if (existingFile?.openai_file_id) {
                openai_file_id = existingFile.openai_file_id;
            }
            else {
                const existingOpenAIFileId = await OpenAIFileService.getExistingOpenAIFile(original_filename || public_id, userId);
                if (existingOpenAIFileId) {
                    openai_file_id = existingOpenAIFileId;
                }
                else {
                    const openaiResult = await OpenAIFileService.uploadFileToOpenAI(secure_url, original_filename || public_id, resource_type, format);
                    if (openaiResult.success && openaiResult.file_id) {
                        openai_file_id = openaiResult.file_id;
                    }
                    else {
                    }
                }
            }
        }
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
export const getConversationFiles = async (req, res) => {
    try {
        const userId = req.user?.id;
        const conversationId = req.params.conversationId;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || "Failed to get conversation files",
        });
    }
};
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
        if (file.uploaded_by !== userId) {
            return res.status(403).json({
                success: false,
                error: "Access denied",
            });
        }
        try {
            await CloudinaryService.deleteFile(file.public_id, file.resource_type);
        }
        catch (error) {
        }
        if (file.openai_file_id) {
            try {
                await OpenAIFileService.deleteOpenAIFile(file.openai_file_id);
            }
            catch (error) {
            }
        }
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
