import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();
const apiKey = process.env.OPENAI_API_KEY;
let openai;
try {
    openai = new OpenAI({ apiKey: apiKey ?? undefined });
}
catch (e) {
    openai = null;
}
export function isFileSupportedByOpenAI(resourceType, format) {
    if (!format)
        return false;
    const supportedFormats = [
        "txt",
        "json",
        "jsonl",
        "csv",
        "tsv",
        "pdf",
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
    ];
    return supportedFormats.includes(format.toLowerCase());
}
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
    if (!isFileSupportedByOpenAI(resourceType, format)) {
        return {
            success: false,
            error: `File type ${format} not supported by OpenAI File API`,
        };
    }
    try {
        const response = await fetch(secureUrl);
        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        let purpose = "assistants";
        if (format === "txt" || format === "pdf" || format === "json") {
            purpose = "assistants";
        }
        const tempFilePath = path.join(process.cwd(), "temp", `temp_${Date.now()}_${originalFilename}`);
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        fs.writeFileSync(tempFilePath, buffer);
        try {
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
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
            catch (cleanupError) {
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
export async function getExistingOpenAIFile(originalFilename, uploadedBy) {
    try {
        if (!openai) {
            return null;
        }
        const files = await openai.files.list();
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
