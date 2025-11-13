import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";
export const processFile = async (secureUrl, resourceType, format) => {
    try {
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
        return {};
    }
    catch (error) {
        return { error: error.message };
    }
};
const extractTextFromPDF = async (url) => {
    try {
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const data = await pdfParse(buffer);
        return {
            extracted_text: data.text || "[PDF contains no extractable text]",
            pages: data.numpages || 1,
        };
    }
    catch (error) {
        return {
            error: `Failed to extract text from PDF: ${error.message}`,
            extracted_text: "[PDF text extraction failed]",
        };
    }
};
const extractTextFromDOCX = async (url) => {
    try {
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        return {
            extracted_text: result.value || "[DOCX contains no extractable text]",
        };
    }
    catch (error) {
        return {
            error: `Failed to extract text from DOCX: ${error.message}`,
            extracted_text: "[DOCX text extraction failed]",
        };
    }
};
const extractTextFromCSV = async (url) => {
    try {
        const response = await fetch(url);
        const csvContent = await response.text();
        const lines = csvContent.split("\n");
        const headers = lines[0]?.split(",") || [];
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
