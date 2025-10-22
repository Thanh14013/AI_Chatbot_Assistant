/**
 * File Processor Service
 * Handles extraction of text content from various file types (PDF, DOCX, CSV)
 */
// Note: We'll process files by downloading from Cloudinary URL
// This avoids storing files locally on the server
/**
 * Process file based on its type and extract text content
 */
export const processFile = async (secureUrl, resourceType, format) => {
    try {
        // For documents, extract text
        if (resourceType === "raw") {
            switch (format.toLowerCase()) {
                case "pdf":
                    return await extractTextFromPDF(secureUrl);
                case "doc":
                case "docx":
                    return await extractTextFromDOCX(secureUrl);
                case "csv":
                    return await extractTextFromCSV(secureUrl);
                case "txt":
                    return await extractTextFromTXT(secureUrl);
                default:
                    return { error: `Unsupported document format: ${format}` };
            }
        }
        // For images and videos, no text extraction needed (handled by OpenAI vision)
        return {};
    }
    catch (error) {
        console.error("File processing error:", error);
        return { error: error.message };
    }
};
/**
 * Extract text from PDF
 * Note: For production, you'd use pdf-parse or similar library
 * For now, we'll use a placeholder that returns a message
 */
const extractTextFromPDF = async (url) => {
    try {
        // Download PDF
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        // TODO: Implement actual PDF text extraction using pdf-parse
        // const pdfParse = require('pdf-parse');
        // const data = await pdfParse(buffer);
        // return {
        //   extracted_text: data.text,
        //   pages: data.numpages,
        // };
        // Placeholder for now
        return {
            extracted_text: "[PDF content - text extraction will be implemented with pdf-parse library]",
            pages: 1,
        };
    }
    catch (error) {
        return { error: `Failed to extract text from PDF: ${error.message}` };
    }
};
/**
 * Extract text from DOCX
 * Note: For production, use mammoth library
 */
const extractTextFromDOCX = async (url) => {
    try {
        // Download DOCX
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        // TODO: Implement actual DOCX text extraction using mammoth
        // const mammoth = require('mammoth');
        // const result = await mammoth.extractRawText({ buffer });
        // return {
        //   extracted_text: result.value,
        // };
        // Placeholder for now
        return {
            extracted_text: "[DOCX content - text extraction will be implemented with mammoth library]",
        };
    }
    catch (error) {
        return { error: `Failed to extract text from DOCX: ${error.message}` };
    }
};
/**
 * Extract text from CSV
 */
const extractTextFromCSV = async (url) => {
    try {
        // Download CSV
        const response = await fetch(url);
        const csvContent = await response.text();
        // Parse CSV into readable format
        const lines = csvContent.split("\n");
        const headers = lines[0]?.split(",") || [];
        // Format as readable text
        let formattedText = "CSV Data:\n\n";
        formattedText += `Headers: ${headers.join(", ")}\n\n`;
        formattedText += `Total rows: ${lines.length - 1}\n\n`;
        formattedText += "Sample data (first 10 rows):\n";
        for (let i = 1; i < Math.min(11, lines.length); i++) {
            const row = lines[i].split(",");
            formattedText += `Row ${i}: `;
            headers.forEach((header, index) => {
                formattedText += `${header.trim()}="${row[index]?.trim() || ""}" `;
            });
            formattedText += "\n";
        }
        return {
            extracted_text: formattedText,
        };
    }
    catch (error) {
        return { error: `Failed to extract text from CSV: ${error.message}` };
    }
};
/**
 * Extract text from TXT file
 */
const extractTextFromTXT = async (url) => {
    try {
        const response = await fetch(url);
        const text = await response.text();
        return {
            extracted_text: text,
        };
    }
    catch (error) {
        return { error: `Failed to extract text from TXT: ${error.message}` };
    }
};
/**
 * Chunk large text into smaller pieces for OpenAI
 */
export const chunkText = (text, maxChunkSize = 4000) => {
    const chunks = [];
    let currentChunk = "";
    const sentences = text.split(/[.!?]\s+/);
    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }
            // If single sentence is too long, split it
            if (sentence.length > maxChunkSize) {
                const words = sentence.split(" ");
                for (const word of words) {
                    if (currentChunk.length + word.length > maxChunkSize) {
                        chunks.push(currentChunk.trim());
                        currentChunk = word + " ";
                    }
                    else {
                        currentChunk += word + " ";
                    }
                }
            }
            else {
                currentChunk = sentence + ". ";
            }
        }
        else {
            currentChunk += sentence + ". ";
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
};
export default {
    processFile,
    chunkText,
};
