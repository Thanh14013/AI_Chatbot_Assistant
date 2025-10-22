import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
// Create OpenAI client; if API key is missing we still export a client
const apiKey = process.env.OPENAI_API_KEY;
let openai;
try {
    // Try class-style construction first
    openai = new OpenAI({ apiKey: apiKey ?? undefined });
}
catch (e) {
    // Fallback: call as function/factory
    try {
        openai = OpenAI({ apiKey: apiKey ?? undefined });
    }
    catch (err) {
        // As a last resort, export a minimal stub that throws on use with a helpful message
        openai = {
            chat: {
                completions: {
                    create: async () => {
                        throw new Error('OpenAI client not initialized correctly. Ensure you have the official "openai" npm package installed and that it supports the usage pattern used in this project.');
                    },
                },
            },
        };
    }
}
// Test connection function (safe: doesn't throw when API key is missing)
export async function testOpenAIConnection() {
    if (!apiKey) {
        // OPENAI_API_KEY not set — skip connection test in silent mode
        return;
    }
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5-nano",
            messages: [{ role: "user", content: "Hello, can you hear me?" }],
        });
        const text = response?.choices?.[0]?.message?.content;
        // Connection succeeded — intentionally silent (no console output)
    }
    catch (error) {
        // Re-throw the error so callers can handle/report it via configured logging
        throw error;
    }
}
/**
 * Call OpenAI Chat Completion API
 * Supports system prompt, temperature, and max_tokens parameters
 * Handles streaming and non-streaming responses
 *
 * @param params - Chat completion parameters
 * @returns Promise with AI response and token usage
 * @throws Error if API call fails
 */
export async function getChatCompletion(params) {
    // Check if API key is configured
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured. Please set it in your .env file.");
    }
    // Set default values
    const { messages, model = "gpt-5-nano", temperature = 0.7, max_completion_tokens = 2000, stream = false, } = params;
    // Validate messages array
    if (!messages || messages.length === 0) {
        throw new Error("Messages array cannot be empty");
    }
    try {
        // If streaming is enabled, handle stream response
        if (stream) {
            return await handleStreamingResponse({
                messages,
                model,
                temperature,
                max_completion_tokens,
            });
        }
        // Build a request payload and only include parameters that are supported
        // by the target model. Some models (for example, certain gpt-5 variants)
        // don't support a custom temperature or expect a different token param name.
        const modelCapabilities = {
            // Based on runtime errors observed, gpt-5-nano does not accept custom temperatures
            "gpt-5-nano": { supportsTemperature: false },
            // Add other known model capabilities here as needed
        };
        const capabilities = modelCapabilities[model] ?? { supportsTemperature: true };
        const requestPayload = {
            model,
            messages,
            stream: false,
        };
        // Only add temperature if the model supports it
        if (capabilities.supportsTemperature && typeof temperature === "number") {
            requestPayload.temperature = temperature;
        }
        // Use max_completion_tokens when provided
        if (typeof max_completion_tokens === "number") {
            requestPayload.max_completion_tokens = max_completion_tokens;
        }
        // Non-streaming response
        const response = await openai.chat.completions.create(requestPayload);
        // Extract response data and token breakdown when available
        const content = response.choices[0]?.message?.content || "";
        const prompt_tokens = response.usage?.prompt_tokens || 0;
        const completion_tokens = response.usage?.completion_tokens || 0;
        const total_tokens = response.usage?.total_tokens || prompt_tokens + completion_tokens || 0;
        // If OpenAI returned an empty string for content, treat as an error so
        // callers won't persist empty assistant messages. This can happen when
        // the model or SDK returns an incomplete response.
        if (!content || (typeof content === "string" && content.trim() === "")) {
            throw new Error("OpenAI returned empty content");
        }
        const finish_reason = response.choices[0]?.finish_reason || "stop";
        return {
            content,
            tokens_used: total_tokens,
            model,
            finish_reason,
            prompt_tokens,
            completion_tokens,
            total_tokens,
        };
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
        throw new Error(`OpenAI API error: ${errorMessage}`);
    }
}
/**
 * Handle streaming response from OpenAI
 * Collects all chunks and returns complete response
 *
 * @param params - Chat completion parameters
 * @returns Promise with complete AI response
 */
async function handleStreamingResponse(params) {
    const { messages, model, temperature, max_completion_tokens } = params;
    try {
        const modelCapabilities = {
            "gpt-5-nano": { supportsTemperature: false },
        };
        const capabilities = modelCapabilities[model] ?? { supportsTemperature: true };
        const payload = {
            model,
            messages,
            stream: true,
        };
        if (capabilities.supportsTemperature && typeof temperature === "number") {
            payload.temperature = temperature;
        }
        if (typeof max_completion_tokens === "number") {
            payload.max_completion_tokens = max_completion_tokens;
        }
        const stream = await openai.chat.completions.create(payload);
        let fullContent = "";
        let tokens_used = 0;
        let finish_reason = "stop";
        // Collect all chunks from stream
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
                fullContent += delta.content;
            }
            if (chunk.choices[0]?.finish_reason) {
                finish_reason = chunk.choices[0].finish_reason;
            }
        }
        // Estimate token usage (rough approximation: 1 token ≈ 4 characters)
        const estimated_completion_tokens = estimateTokenCount(fullContent);
        const estimated_prompt_tokens = estimateTokenCount(messages.map((m) => m.content).join(" "));
        tokens_used = estimated_completion_tokens + estimated_prompt_tokens;
        // If streaming produced no content, treat as an error
        if (!fullContent || fullContent.trim() === "") {
            throw new Error("OpenAI streaming returned empty content");
        }
        return {
            content: fullContent,
            tokens_used,
            model,
            finish_reason,
            prompt_tokens: estimated_prompt_tokens,
            completion_tokens: estimated_completion_tokens,
            total_tokens: tokens_used,
        };
    }
    catch (error) {
        throw new Error(`Streaming error: ${error?.message || "Unknown error"}`);
    }
}
/**
 * Estimate token count for text
 * Simple approximation: 1 token ≈ 4 characters
 * For more accurate counting, use tiktoken library
 *
 * @param text - Text to count tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text) {
    // Simple estimation: average 4 characters per token
    // This is a rough approximation and should be replaced with tiktoken for production
    return Math.ceil(text.length / 4);
}
/**
 * Build context array from messages for OpenAI API
 * Takes the N most recent messages and adds system prompt
 * Truncates if total tokens exceed max limit
 *
 * @param messages - Array of conversation messages
 * @param contextWindow - Number of recent messages to include
 * @param systemPrompt - Optional system prompt to prepend
 * @param maxTokens - Maximum total tokens allowed in context (default: 4000)
 * @returns Array of messages formatted for OpenAI API
 */
export function buildContextArray(messages, contextWindow = 10, systemPrompt, maxTokens = 4000) {
    const contextMessages = [];
    // Add system prompt if provided
    if (systemPrompt) {
        contextMessages.push({
            role: "system",
            content: systemPrompt,
        });
    }
    // Get N most recent messages
    const recentMessages = messages.slice(-contextWindow);
    // Add messages and track token count
    let totalTokens = systemPrompt ? estimateTokenCount(systemPrompt) : 0;
    // Add messages in reverse order (newest first) to ensure we keep most recent
    const messagesToAdd = [];
    for (let i = recentMessages.length - 1; i >= 0; i--) {
        const message = recentMessages[i];
        const messageTokens = estimateTokenCount(message.content);
        // Check if adding this message would exceed max tokens
        if (totalTokens + messageTokens > maxTokens) {
            break; // Stop adding older messages
        }
        messagesToAdd.unshift({
            role: message.role,
            content: message.content,
        });
        totalTokens += messageTokens;
    }
    // Combine system prompt with messages
    return [...contextMessages, ...messagesToAdd];
}
/**
 * Get N most recent messages from a conversation
 * Useful for building context window
 *
 * @param allMessages - All messages in conversation
 * @param count - Number of recent messages to get
 * @returns Array of recent messages
 */
export function getRecentMessages(allMessages, count) {
    if (allMessages.length <= count) {
        return allMessages;
    }
    return allMessages.slice(-count);
}
/**
 * Build message content with attachments for OpenAI multimodal API
 * Supports images (vision) and document text content
 *
 * @param textContent - The text message content
 * @param attachments - Array of file attachments
 * @returns Message content formatted for OpenAI API
 */
export function buildMessageContentWithAttachments(textContent, attachments) {
    // If no attachments, return simple text
    if (!attachments || attachments.length === 0) {
        return textContent;
    }
    // Check if any attachment is an image (requires vision API)
    const hasImages = attachments.some((att) => att.resource_type === "image");
    if (hasImages) {
        // Build multimodal content array for vision API
        const content = [];
        // Add text content first with file context
        let mainText = textContent || "Please analyze the attached files.";
        // Add file URLs as context for non-image files
        const nonImageFiles = attachments.filter((att) => att.resource_type !== "image");
        if (nonImageFiles.length > 0) {
            mainText += "\n\n📎 Attached Files:\n";
            nonImageFiles.forEach((att, idx) => {
                const fileType = att.format?.toUpperCase() || att.resource_type.toUpperCase();
                mainText += `${idx + 1}. [${fileType} File] - Access via URL: ${att.secure_url}\n`;
            });
            mainText += "\nYou can reference these file URLs in your response if needed.";
        }
        content.push({
            type: "text",
            text: mainText,
        });
        // Add images with context
        const imageAttachments = attachments.filter((att) => att.resource_type === "image");
        imageAttachments.forEach((att, idx) => {
            content.push({
                type: "image_url",
                image_url: {
                    url: att.secure_url,
                },
            });
        });
        // Add extracted text from documents
        attachments.forEach((att) => {
            if (att.resource_type === "raw" && att.extracted_text) {
                content.push({
                    type: "text",
                    text: `\n\n--- ${att.format?.toUpperCase()} Document Content (extracted) ---\n${att.extracted_text}\n--- End of ${att.format?.toUpperCase()} ---`,
                });
            }
        });
        return content;
    }
    else {
        // No images, just append document text and URLs to message
        let fullContent = textContent || "Please analyze the attached files.";
        // Add file URLs
        fullContent += "\n\n📎 Attached Files:\n";
        attachments.forEach((att, idx) => {
            const fileType = att.format?.toUpperCase() || att.resource_type.toUpperCase();
            fullContent += `${idx + 1}. [${fileType} File] - URL: ${att.secure_url}\n`;
        });
        // Add extracted text if available
        attachments.forEach((att) => {
            if (att.extracted_text) {
                fullContent += `\n\n--- ${att.format?.toUpperCase()} Document Content (extracted) ---\n${att.extracted_text}\n--- End of ${att.format?.toUpperCase()} ---`;
            }
        });
        fullContent +=
            "\n\nYou can reference these file URLs in your response if the user needs to access them.";
        return fullContent;
    }
}
/**
 * Determine the appropriate OpenAI model based on message content
 * Uses vision model if images are present, otherwise uses default
 *
 * @param hasImages - Whether the message contains images
 * @returns Model name to use
 */
export function selectModelForContent(hasImages) {
    if (hasImages) {
        // Use GPT-4 Vision for image analysis
        return "gpt-4o"; // or 'gpt-4-vision-preview'
    }
    return "gpt-5-nano"; // Default model
}
export default openai;
