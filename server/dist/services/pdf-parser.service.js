import https from "https";
import http from "http";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
function downloadPDF(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith("https") ? https : http;
        client
            .get(url, (response) => {
            const chunks = [];
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
export async function extractTextFromPDF(pdfUrl) {
    try {
        const pdfBuffer = await downloadPDF(pdfUrl);
        const pdfParser = new PDFParse({ data: pdfBuffer });
        const data = await pdfParser.getText();
        const extractedText = data.text.trim();
        const pageCount = data.total;
        const textLength = extractedText.length;
        if (!extractedText || extractedText.length === 0) {
            return "[This PDF appears to be image-based or contains no extractable text. The file may be a scanned document. For image-based PDFs, consider using OCR (Optical Character Recognition) tools to extract text first.]";
        }
        if (textLength < 50) {
            return `${extractedText}\n\n[Note: Only ${textLength} characters were extracted. This PDF may contain primarily images or have limited text content.]`;
        }
        return extractedText;
    }
    catch (error) {
        return `[Failed to extract text from PDF: ${error?.message || "Unknown error"}. The file may be corrupted, encrypted, or in an unsupported format.]`;
    }
}
export async function extractTextFromPDFBuffer(pdfBuffer) {
    try {
        const pdfParser = new PDFParse({ data: pdfBuffer });
        const data = await pdfParser.getText();
        const extractedText = data.text.trim();
        if (!extractedText || extractedText.length === 0) {
            return "[This PDF appears to be image-based or encrypted. Text extraction not available.]";
        }
        return extractedText;
    }
    catch (error) {
        return `[Failed to extract text from PDF: ${error?.message || "Unknown error"}]`;
    }
}
