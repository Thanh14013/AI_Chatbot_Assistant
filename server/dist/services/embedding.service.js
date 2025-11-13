import OpenAI from "openai";
import dotenv from "dotenv";
import MessageEmbedding from "../models/message-embedding.model.js";
import sequelize from "../db/database.config.js";
import { QueryTypes } from "sequelize";
dotenv.config();
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
export async function generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
        throw new Error("Text cannot be empty for embedding generation");
    }
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured. Please set it in your .env file to enable semantic search.");
    }
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text.trim(),
            encoding_format: "float",
        });
        const embedding = response.data[0].embedding;
        if (!embedding || embedding.length !== 1536) {
            throw new Error(`Invalid embedding dimensions: expected 1536, got ${embedding?.length || 0}`);
        }
        return embedding;
    }
    catch (error) {
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
        const errorMessage = error?.message || "Unknown error occurred";
        throw new Error(`OpenAI Embeddings API error: ${errorMessage}`);
    }
}
export async function generateAndStoreEmbedding(messageId, content) {
    try {
        const existingEmbedding = await MessageEmbedding.findByMessageId(messageId);
        if (existingEmbedding) {
            return null;
        }
        const embeddingVector = await generateEmbedding(content);
        try {
            const vectorString = `[${embeddingVector.join(",")}]`;
            const insertSql = `INSERT INTO message_embeddings (message_id, embedding, created_at) VALUES ($1, $2::vector, now()) ON CONFLICT (message_id) DO NOTHING`;
            await sequelize.query(insertSql, {
                bind: [messageId, vectorString],
                type: QueryTypes.INSERT,
            });
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
        if ((error?.message || "").includes("API key") ||
            (error?.message || "").includes("not configured")) {
            throw error;
        }
        return null;
    }
}
export async function batchGenerateEmbeddings(messages) {
    const results = [];
    for (const { messageId, content } of messages) {
        try {
            const embedding = await generateAndStoreEmbedding(messageId, content);
            if (embedding) {
                results.push(embedding);
            }
        }
        catch (error) {
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return results;
}
export async function deleteEmbedding(messageId) {
    return MessageEmbedding.deleteByMessageId(messageId);
}
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
