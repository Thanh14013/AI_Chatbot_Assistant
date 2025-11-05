/**
 * OpenAI File Service
 * Handles uploading files to OpenAI File API and managing file IDs
 */
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();
// Create OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
let openai;
try {
    openai = new OpenAI({ apiKey: apiKey ?? undefined });
}
catch (e) {
    openai = null;
}
/**
 * Check if a file type is supported by OpenAI File API
 * OpenAI supports: jsonl, tsv, csv, json, txt, pdf, images, etc.
 */
export function isFileSupportedByOpenAI(resourceType, format) {
    if (!format)
        return false;
    const supportedFormats = [
        // Text files
        "txt",
        "json",
        "jsonl",
        "csv",
        "tsv",
        // Documents
        "pdf",
        // Images
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
    ];
    return supportedFormats.includes(format.toLowerCase());
}
/**
 * Upload file to OpenAI File API
 * Downloads file from Cloudinary URL and uploads to OpenAI
 */
export async function uploadFileToOpenAI(secureUrl, originalFilename, resourceType, format) {
    if (!openai) {
        return {
            success: false,
            error: "OpenAI client not initialized",
        };
    }
    if (!apiKey) {
        return {
            success: false,
            error: "OPENAI_API_KEY not configured",
        };
    }
    // Check if file type is supported
    if (!isFileSupportedByOpenAI(resourceType, format)) {
        return {
            success: false,
            error: `File type ${format} not supported by OpenAI File API`,
        };
    }
    try {
        // Download file from Cloudinary URL
        const response = await fetch(secureUrl);
        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        // Determine purpose based on file type
        let purpose = "assistants";
        // For text files and documents, use assistants purpose
        if (format === "txt" || format === "pdf" || format === "json") {
            purpose = "assistants";
        }
        // Create a temporary file path for OpenAI upload
        const tempFilePath = path.join(process.cwd(), "temp", `temp_${Date.now()}_${originalFilename}`);
        // Ensure temp directory exists
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        // Write buffer to temporary file
        fs.writeFileSync(tempFilePath, buffer);
        try {
            // Upload to OpenAI File API
            const file = await openai.files.create({
                file: fs.createReadStream(tempFilePath),
                purpose: purpose,
            });
            return {
                success: true,
                file_id: file.id,
                filename: file.filename,
                purpose: file.purpose,
            };
        }
        finally {
            // Clean up temporary file
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
            catch (cleanupError) {
                // Ignore cleanup errors
            }
        }
    }
    catch (error) {
        return {
            success: false,
            error: error.message || "Unknown error occurred during upload",
        };
    }
}
/**
 * Check if file already exists in OpenAI and get its file_id
 * This helps avoid duplicate uploads
 */
export async function getExistingOpenAIFile(originalFilename, uploadedBy) {
    try {
        if (!openai) {
            return null;
        }
        // List files from OpenAI (this might be limited by API)
        const files = await openai.files.list();
        // Look for file with matching filename
        const existingFile = files.data.find((file) => file.filename === originalFilename);
        if (existingFile) {
            return existingFile.id;
        }
        return null;
    }
    catch (error) {
        return null;
    }
}
/**
 * Delete file from OpenAI File API
 */
export async function deleteOpenAIFile(fileId) {
    try {
        if (!openai) {
            return false;
        }
        await openai.files.del(fileId);
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Get file info from OpenAI
 */
export async function getOpenAIFileInfo(fileId) {
    try {
        if (!openai) {
            return null;
        }
        const file = await openai.files.retrieve(fileId);
        return file;
    }
    catch (error) {
        return null;
    }
}
export default {
    uploadFileToOpenAI,
    getExistingOpenAIFile,
    deleteOpenAIFile,
    getOpenAIFileInfo,
    isFileSupportedByOpenAI,
};
