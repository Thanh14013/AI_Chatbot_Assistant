/**
 * File Processor Service
 * Handles extraction of text content from various file types (PDF, DOCX, CSV)
 */

import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Type definitions
export interface FileProcessingResult {
  extracted_text?: string;
  pages?: number;
  thumbnail_url?: string;
  error?: string;
}

// Note: We'll process files by downloading from Cloudinary URL
// This avoids storing files locally on the server

/**
 * Process file based on its type and extract text content
 */
export const processFile = async (
  secureUrl: string,
  resourceType: string,
  format: string
): Promise<FileProcessingResult> => {
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
  } catch (error: any) {
    return { error: error.message };
  }
};

/**
 * Extract text from PDF
 * Uses pdf-parse library for actual text extraction
 */
const extractTextFromPDF = async (url: string): Promise<FileProcessingResult> => {
  try {
    // Download PDF
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Extract text using pdf-parse
    const data = await (pdfParse as any)(buffer);

    return {
      extracted_text: data.text || "[PDF contains no extractable text]",
      pages: data.numpages || 1,
    };
  } catch (error: any) {
    console.error("PDF extraction error:", error);
    return {
      error: `Failed to extract text from PDF: ${error.message}`,
      extracted_text: "[PDF text extraction failed]",
    };
  }
};

/**
 * Extract text from DOCX
 * Uses mammoth library for actual text extraction
 */
const extractTextFromDOCX = async (url: string): Promise<FileProcessingResult> => {
  try {
    // Download DOCX
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Extract text using mammoth
    const result = await mammoth.extractRawText({ buffer });

    return {
      extracted_text: result.value || "[DOCX contains no extractable text]",
    };
  } catch (error: any) {
    console.error("DOCX extraction error:", error);
    return {
      error: `Failed to extract text from DOCX: ${error.message}`,
      extracted_text: "[DOCX text extraction failed]",
    };
  }
};

/**
 * Extract text from CSV
 */
const extractTextFromCSV = async (url: string): Promise<FileProcessingResult> => {
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
      headers.forEach((header: string, index: number) => {
        formattedText += `${header.trim()}="${row[index]?.trim() || ""}" `;
      });
      formattedText += "\n";
    }

    return {
      extracted_text: formattedText,
    };
  } catch (error: any) {
    return { error: `Failed to extract text from CSV: ${error.message}` };
  }
};

/**
 * Extract text from TXT file
 */
const extractTextFromTXT = async (url: string): Promise<FileProcessingResult> => {
  try {
    const response = await fetch(url);
    const text = await response.text();
    return {
      extracted_text: text,
    };
  } catch (error: any) {
    return { error: `Failed to extract text from TXT: ${error.message}` };
  }
};

/**
 * Chunk large text into smaller pieces for OpenAI
 */
export const chunkText = (text: string, maxChunkSize: number = 4000): string[] => {
  const chunks: string[] = [];
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
          } else {
            currentChunk += word + " ";
          }
        }
      } else {
        currentChunk = sentence + ". ";
      }
    } else {
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
