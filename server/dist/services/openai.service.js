import OpenAI from "openai";
import dotenv from "dotenv";
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
export async function testOpenAIConnection() {
    if (!apiKey) {
        return;
    }
    try {
        const response = await openai.chat.completions.create({
<<<<<<< HEAD
            model: "gpt-4.1-mini",
=======
            model: "gpt-4o-mini",
>>>>>>> b5a25b404b0fd5beee8e603d5df07ab1ee134af5
            messages: [{ role: "user", content: "Hello, can you hear me?" }],
        });
        const text = response?.choices?.[0]?.message?.content;
    }
    catch (error) {
        throw error;
    }
}
export async function getChatCompletionWithRetry(params, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await getChatCompletion(params);
            if (!result.content || result.content.trim() === "") {
                throw new Error("OpenAI returned empty content");
            }
            return result;
        }
        catch (error) {
            lastError = error;
            if (error.message?.includes("Invalid OpenAI API key") || error.status === 401) {
                throw error;
            }
            if (error.status >= 400 && error.status < 500 && error.status !== 429) {
                throw error;
            }
            if (attempt >= maxRetries) {
                break;
            }
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError || new Error("Max retries exceeded");
}
export async function getChatCompletion(params) {
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured. Please set it in your .env file.");
    }
    const { messages, model = "gpt-4o", temperature = 0.7, max_completion_tokens = 2000, stream = false, } = params;
    if (!messages || messages.length === 0) {
        throw new Error("Messages array cannot be empty");
    }
    try {
        if (stream) {
            return await handleStreamingResponse({
                messages,
                model,
                temperature,
                max_completion_tokens,
            });
        }
        const modelCapabilities = {
            "gpt-5-nano": { supportsTemperature: false },
        };
        const capabilities = modelCapabilities[model] ?? { supportsTemperature: true };
        const requestPayload = {
            model,
            messages,
            stream: false,
        };
        if (capabilities.supportsTemperature && typeof temperature === "number") {
            requestPayload.temperature = temperature;
        }
        if (typeof max_completion_tokens === "number") {
            requestPayload.max_completion_tokens = max_completion_tokens;
        }
        const response = await openai.chat.completions.create(requestPayload);
        const content = response.choices[0]?.message?.content || "";
        const prompt_tokens = response.usage?.prompt_tokens || 0;
        const completion_tokens = response.usage?.completion_tokens || 0;
        const total_tokens = response.usage?.total_tokens || prompt_tokens + completion_tokens || 0;
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
        throw new Error(`OpenAI API error: ${errorMessage}`);
    }
}
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
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
                fullContent += delta.content;
            }
            if (chunk.choices[0]?.finish_reason) {
                finish_reason = chunk.choices[0].finish_reason;
            }
        }
        const estimated_completion_tokens = estimateTokenCount(fullContent);
        const estimated_prompt_tokens = estimateTokenCount(messages.map((m) => m.content).join(" "));
        tokens_used = estimated_completion_tokens + estimated_prompt_tokens;
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
export function estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
}
export function buildContextArray(messages, contextWindow = 10, systemPrompt, maxTokens = 4000) {
    const contextMessages = [];
    if (systemPrompt) {
        contextMessages.push({
            role: "system",
            content: systemPrompt,
        });
    }
    const recentMessages = messages.slice(-contextWindow);
    let totalTokens = systemPrompt ? estimateTokenCount(systemPrompt) : 0;
    const messagesToAdd = [];
    for (let i = recentMessages.length - 1; i >= 0; i--) {
        const message = recentMessages[i];
        const messageTokens = estimateTokenCount(message.content);
        if (totalTokens + messageTokens > maxTokens) {
            break;
        }
        messagesToAdd.unshift({
            role: message.role,
            content: message.content,
        });
        totalTokens += messageTokens;
    }
    return [...contextMessages, ...messagesToAdd];
}
export function getRecentMessages(allMessages, count) {
    if (allMessages.length <= count) {
        return allMessages;
    }
    return allMessages.slice(-count);
}
export function buildMessageContentWithAttachments(textContent, attachments) {
    if (!attachments || attachments.length === 0) {
        return textContent;
    }
    const supportedImageFormats = ["png", "jpg", "jpeg", "gif", "webp"];
    const hasImages = attachments.some((att) => att.resource_type === "image" &&
        supportedImageFormats.includes(att.format?.toLowerCase() || ""));
    if (hasImages) {
        const content = [];
        let mainText = textContent || "Please analyze the attached files.";
        const supportedImageFormats = ["png", "jpg", "jpeg", "gif", "webp"];
        const documentFiles = attachments.filter((att) => att.resource_type !== "image" ||
            !supportedImageFormats.includes(att.format?.toLowerCase() || ""));
        if (documentFiles.length > 0) {
            mainText += "\n\n📎 Attached Files:\n";
            documentFiles.forEach((att, idx) => {
                const fileType = att.format?.toUpperCase() || att.resource_type.toUpperCase();
                mainText += `${idx + 1}. [${fileType} File]`;
                if (att.openai_file_id) {
                    mainText += ` - OpenAI File ID: ${att.openai_file_id}\n`;
                }
                else {
                    mainText += `\n`;
                }
                if (att.extracted_text) {
                    mainText += `\n--- ${fileType} Document Content ---\n${att.extracted_text}\n--- End of ${fileType} ---\n\n`;
                }
            });
        }
        content.push({
            type: "text",
            text: mainText,
        });
        const realImageAttachments = attachments.filter((att) => att.resource_type === "image" &&
            supportedImageFormats.includes(att.format?.toLowerCase() || ""));
        realImageAttachments.forEach((att) => {
            content.push({
                type: "image_url",
                image_url: {
                    url: att.secure_url,
                },
            });
        });
        return content;
    }
    else {
        let fullContent = textContent || "Please analyze the attached files.";
        fullContent += "\n\n📎 Attached Files:\n";
        attachments.forEach((att, idx) => {
            const fileType = att.format?.toUpperCase() || att.resource_type.toUpperCase();
            fullContent += `${idx + 1}. [${fileType} File]`;
            if (att.openai_file_id) {
                fullContent += ` - OpenAI File ID: ${att.openai_file_id}\n`;
            }
            else {
                fullContent += `\n`;
            }
            if (att.extracted_text) {
                fullContent += `\n--- ${fileType} Document Content ---\n${att.extracted_text}\n--- End of ${fileType} ---\n\n`;
            }
        });
        return fullContent;
    }
}
export function selectModelForContent(hasImages) {
    if (hasImages) {
        return "gpt-4o";
    }
    return "GPT-5 mini";
}
export default openai;
