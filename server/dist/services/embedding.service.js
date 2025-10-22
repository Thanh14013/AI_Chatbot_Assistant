import OpenAI from "openai";
import dotenv from "dotenv";
import MessageEmbedding from "../models/message-embedding.model.js";
import sequelize from "../db/database.config.js";
import { QueryTypes } from "sequelize";
dotenv.config();
// Create OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
let openai;
try {
    openai = new OpenAI({ apiKey: apiKey ?? undefined });
}
catch (e) {
    try {
        openai = OpenAI({ apiKey: apiKey ?? undefined });
    }
    catch (err) {
        openai = {
            embeddings: {
                create: async () => {
                    throw new Error('OpenAI client not initialized correctly. Ensure you have the official "openai" npm package installed and OPENAI_API_KEY is set.');
                },
            },
        };
    }
}
/**
 * Generate embedding for text using OpenAI Embeddings API
 * Uses text-embedding-3-small model (1536 dimensions)
 *
 * NOTE: For Vietnamese text, similarity scores tend to be lower than English
 * due to complex diacritics and tokenization. Typical good matches: 0.5-0.7
 * Consider using text-embedding-3-large (3072 dims) for higher accuracy if needed.
 *
 * @param text - Text to generate embedding for
 * @returns Promise with 1536-dimensional embedding vector
 * @throws Error if API call fails or API key is missing
 */
export async function generateEmbedding(text) {
    // Validate input
    if (!text || text.trim().length === 0) {
        throw new Error("Text cannot be empty for embedding generation");
    }
    // Check if API key is configured
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured. Please set it in your .env file to enable semantic search.");
    }
    try {
        // Call OpenAI Embeddings API
        // Model: text-embedding-3-small (1536 dimensions, cost-effective)
        // Alternative: text-embedding-3-large (3072 dimensions, more accurate but costly)
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text.trim(),
            encoding_format: "float", // Return as array of floats
        });
        // Extract embedding from response
        const embedding = response.data[0].embedding;
        // Validate embedding dimensions
        if (!embedding || embedding.length !== 1536) {
            throw new Error(`Invalid embedding dimensions: expected 1536, got ${embedding?.length || 0}`);
        }
        return embedding;
    }
    catch (error) {
        // Handle different types of errors
        if (error?.status === 401) {
            throw new Error("Invalid OpenAI API key");
        }
        else if (error?.status === 429) {
            throw new Error("OpenAI rate limit exceeded. Please try again later.");
        }
        else if (error?.status === 500) {
            throw new Error("OpenAI server error. Please try again later.");
        }
        else if (error?.code === "ENOTFOUND" || error?.code === "ECONNREFUSED") {
            throw new Error("Unable to connect to OpenAI API. Check your network connection.");
        }
        // Generic error
        const errorMessage = error?.message || "Unknown error occurred";
        throw new Error(`OpenAI Embeddings API error: ${errorMessage}`);
    }
}
/**
 * Generate and store embedding for a message
 * Automatically called when a new message is created
 * Skips if embedding already exists
 *
 * @param messageId - Message ID
 * @param content - Message content to embed
 * @returns Promise with created embedding or null if already exists
 * @throws Error if embedding generation or storage fails
 */
export async function generateAndStoreEmbedding(messageId, content) {
    try {
        // Check if embedding already exists
        const existingEmbedding = await MessageEmbedding.findByMessageId(messageId);
        if (existingEmbedding) {
            // Embedding already exists, skip generation
            return null;
        }
        // Generate embedding
        const embeddingVector = await generateEmbedding(content);
        // Store in database using raw query and cast to pgvector to avoid Sequelize -> vector issues
        try {
            const vectorString = `[${embeddingVector.join(",")}]`;
            const insertSql = `INSERT INTO message_embeddings (message_id, embedding, created_at) VALUES ($1, $2::vector, now()) ON CONFLICT (message_id) DO NOTHING`;
            await sequelize.query(insertSql, {
                bind: [messageId, vectorString],
                type: QueryTypes.INSERT,
            });
            // Return a lightweight object instead of Sequelize instance (embedding optional)
            return {
                id: null,
                message_id: messageId,
                embedding: embeddingVector,
                created_at: new Date(),
            };
        }
        catch (dbErr) {
            return null;
        }
    }
    catch (error) {
        // Log error but don't throw - embedding generation is optional
        // The message should still be created even if embedding fails
        // Re-throw critical errors (like invalid API key) so they can be handled at higher levels
        if ((error?.message || "").includes("API key") ||
            (error?.message || "").includes("not configured")) {
            throw error;
        }
        // For other errors (rate limits, network issues), return null and continue
        return null;
    }
}
/**
 * Batch generate embeddings for multiple messages
 * Useful for backfilling embeddings for existing messages
 *
 * @param messages - Array of {messageId, content} objects
 * @returns Promise with array of created embeddings
 */
export async function batchGenerateEmbeddings(messages) {
    const results = [];
    // Process messages sequentially to avoid rate limits
    for (const { messageId, content } of messages) {
        try {
            const embedding = await generateAndStoreEmbedding(messageId, content);
            if (embedding) {
                results.push(embedding);
            }
        }
        catch (error) {
            // Continue with next message even if one fails
        }
        // Add a small delay to avoid hitting rate limits
        // OpenAI free tier: ~3 requests/minute for embeddings
        // Adjust based on your OpenAI plan
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
    }
    return results;
}
/**
 * Delete embedding for a message
 * Automatically called when a message is deleted (via CASCADE)
 * This function is for manual deletion if needed
 *
 * @param messageId - Message ID
 * @returns Promise with number of deleted rows
 */
export async function deleteEmbedding(messageId) {
    return MessageEmbedding.deleteByMessageId(messageId);
}
/**
 * Check if embedding exists for a message
 *
 * @param messageId - Message ID
 * @returns Promise with boolean
 */
export async function hasEmbedding(messageId) {
    return MessageEmbedding.existsForMessage(messageId);
}
export default {
    generateEmbedding,
    generateAndStoreEmbedding,
    batchGenerateEmbeddings,
    deleteEmbedding,
    hasEmbedding,
};
