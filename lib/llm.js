// DeepSeek/LLM wrapper
// lib/llm.js
import OpenAI from "openai";

// Using DeepSeek API
const apiKey = process.env.DEEPSEEK_API_KEY;
const baseURL = process.env.DEEPSEEK_BASE_URL;
const modelName = process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat";

// Initialize client only if API key is available (prevents build errors)
let client = null;
if (apiKey) {
  client = new OpenAI({
    apiKey,
    baseURL,
  });
}

export async function askLLM(question, context, options = {}) {
  // Check if client is available (API key is set)
  if (!client) {
    throw new Error("OpenAI client not initialized. Please check your API key configuration.");
  }

  const { timeoutMs = 30000 } = options;
  const systemPrompt = `You are a helpful assistant for health workers.
Answer questions using the provided context from WHO guidelines.
Be concise and professional. Cite sources when possible.`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Context:\n${context}\n\nQuestion: ${question}`,
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await client.chat.completions.create({
      model: modelName,
      messages,
      temperature: 0.2,
      signal: controller.signal,
    });
    return response.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
}
