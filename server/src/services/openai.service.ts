import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Create OpenAI client; if API key is missing we still export a client
const apiKey = process.env.OPENAI_API_KEY;

let openai: any;
try {
  // Try class-style construction first
  openai = new (OpenAI as any)({ apiKey: apiKey ?? undefined });
} catch (e) {
  // Fallback: call as function/factory
  try {
    openai = (OpenAI as any)({ apiKey: apiKey ?? undefined });
  } catch (err) {
    // As a last resort, export a minimal stub that throws on use with a helpful message
    openai = {
      chat: {
        completions: {
          create: async () => {
            throw new Error(
              'OpenAI client not initialized correctly. Ensure you have the official "openai" npm package installed and that it supports the usage pattern used in this project.'
            );
          },
        },
      },
    };
  }
}

// Hàm test kết nối (an toàn: không ném lỗi khi thiếu API key)
export async function testOpenAIConnection() {
  if (!apiKey) {
    console.warn(
      "⚠️  OPENAI_API_KEY not set — skipping OpenAI connection test. Set OPENAI_API_KEY in your .env or environment to enable this test."
    );
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [{ role: "user", content: "Hello, can you hear me?" }],
    });

    const text = response?.choices?.[0]?.message?.content;
    console.log("✅ OpenAI connected successfully!");
    console.log("Response:", text ?? JSON.stringify(response));
  } catch (error: any) {
    // Log the full error object (some SDK errors are objects, not plain Error)
    console.error("❌ OpenAI connection failed:", error?.message ?? error);
  }
}

export default openai;
