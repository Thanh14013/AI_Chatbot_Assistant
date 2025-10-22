/**
 * PDF Parser Service
 * Extracts text content from PDF files using pdf-parse
 */

import https from "https";
import http from "http";
import { createRequire } from "module";

// Use createRequire to import CommonJS module
const require = createRequire(import.meta.url);

// Import PDFParse class from pdf-parse module
const { PDFParse } = require("pdf-parse");

/**
 * Download file from URL as Buffer
 */
function downloadPDF(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          resolve(Buffer.concat(chunks));
        });

        response.on("error", (error) => {
          reject(error);
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Extract text from PDF file URL
 * Downloads the PDF and parses text content
 *
 * @param pdfUrl - URL to the PDF file (Cloudinary URL)
 * @returns Extracted text content
 */
export async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  try {
    console.log("📄 [PDF Parser] Starting PDF text extraction", { pdfUrl });

    // Download PDF as buffer using https/http
    const pdfBuffer = await downloadPDF(pdfUrl);

    console.log("✅ [PDF Parser] PDF downloaded", {
      size: pdfBuffer.length,
      sizeKB: Math.round(pdfBuffer.length / 1024),
    });

    // Parse PDF using PDFParse class
    const pdfParser = new PDFParse({ data: pdfBuffer });
    const data = await pdfParser.getText();

    const extractedText = data.text.trim();
    const pageCount = data.total;
    const textLength = extractedText.length;

    console.log("✅ [PDF Parser] Text extraction completed", {
      pageCount,
      textLength,
      textPreview: extractedText.substring(0, 200) + (textLength > 200 ? "..." : ""),
    });

    // If no text extracted, return helpful message
    if (!extractedText || extractedText.length === 0) {
      console.warn("⚠️ [PDF Parser] No text extracted from PDF (might be image-based)");
      return "[This PDF appears to be image-based or encrypted. Text extraction not available.]";
    }

    return extractedText;
  } catch (error: any) {
    console.error("❌ [PDF Parser] Failed to extract text from PDF", {
      error: error?.message,
      url: pdfUrl,
    });

    // Return error message instead of throwing
    return `[Failed to extract text from PDF: ${error?.message || "Unknown error"}]`;
  }
}

/**
 * Extract text from PDF buffer (for already downloaded files)
 *
 * @param pdfBuffer - PDF file buffer
 * @returns Extracted text content
 */
export async function extractTextFromPDFBuffer(pdfBuffer: Buffer): Promise<string> {
  try {
    console.log("📄 [PDF Parser] Parsing PDF from buffer", {
      size: pdfBuffer.length,
      sizeKB: Math.round(pdfBuffer.length / 1024),
    });

    // Parse PDF using PDFParse class
    const pdfParser = new PDFParse({ data: pdfBuffer });
    const data = await pdfParser.getText();
    const extractedText = data.text.trim();

    console.log("✅ [PDF Parser] Text extraction completed", {
      pageCount: data.total,
      textLength: extractedText.length,
    });

    if (!extractedText || extractedText.length === 0) {
      return "[This PDF appears to be image-based or encrypted. Text extraction not available.]";
    }

    return extractedText;
  } catch (error: any) {
    console.error("❌ [PDF Parser] Failed to extract text from PDF buffer", {
      error: error?.message,
    });
    return `[Failed to extract text from PDF: ${error?.message || "Unknown error"}]`;
  }
}
