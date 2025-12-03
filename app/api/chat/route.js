// Chat endpoint (retrieves + calls LLM)
import { getPineconeClient } from "../../../lib/pinecone";
import { generateEmbedding } from "../../../lib/embedding";
import { askLLM } from "../../../lib/llm";
export const runtime = 'edge';
export async function POST(request) {
  try {
    console.log("Chat API called");
    console.log("Environment check:", {
      hasPineconeKey: !!process.env.PINECONE_API_KEY,
      hasPineconeIndex: !!process.env.PINECONE_INDEX,
      hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
      hasDeepSeekBaseURL: !!process.env.DEEPSEEK_BASE_URL,
      deepSeekBaseURL: process.env.DEEPSEEK_BASE_URL,
      pineconeIndex: process.env.PINECONE_INDEX
    });
    
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
      console.log("Pinecone not configured");
      return Response.json({ 
        error: "Vector store not configured", 
        debug: {
          hasPineconeKey: !!process.env.PINECONE_API_KEY,
          hasPineconeIndex: !!process.env.PINECONE_INDEX,
          pineconeIndex: process.env.PINECONE_INDEX
        }
      }, { status: 500 });
    }
    if (!process.env.DEEPSEEK_API_KEY || !process.env.DEEPSEEK_BASE_URL) {
      console.log("DeepSeek LLM not configured");
      return Response.json({ 
        error: "DeepSeek LLM not configured. Please set DEEPSEEK_API_KEY and DEEPSEEK_BASE_URL in .env",
        debug: {
          hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
          hasDeepSeekBaseURL: !!process.env.DEEPSEEK_BASE_URL,
          deepSeekBaseURL: process.env.DEEPSEEK_BASE_URL
        }
      }, { status: 500 });
    }

    const { question } = await request.json();
    console.log("Question received:", question);
    console.log("Generating embedding...");
    const queryEmbedding = await generateEmbedding(question);
    console.log("Embedding generated, length:", queryEmbedding.length);

    const client = getPineconeClient();
    const index = client.Index(process.env.PINECONE_INDEX);

    console.log("Querying Pinecone...");
    const results = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    });

    const matches = Array.isArray(results?.matches) ? results.matches : [];
    console.log("Pinecone matches:", matches.length);
    
    if (matches.length === 0) {
      console.log("No matches found");
      return Response.json({ answer: "No relevant context found in the knowledge base.", sources: [] });
    }

    const context = matches.map((m) => m.metadata?.text || "").join("\n\n");

    // For testing: return chunked texts instead of LLM response
    const chunkedTexts = matches.map((match, index) => ({
      chunkNumber: index + 1,
      page: match.metadata?.page || "unknown",
      source: match.metadata?.source || "unknown",
      text: match.metadata?.text || "",
      textLength: match.metadata?.text?.length || 0,
      textPreview: match.metadata?.text?.substring(0, 200) + "..." || ""
    }));

    console.log("Calling LLM...");
    const answer = await askLLM(question, context, { timeoutMs: 30000 });
    console.log("LLM response received");

    return Response.json({ 
      answer, 
      sources: matches,
      chunkedTexts: chunkedTexts, // Add this for testing
      totalChunks: chunkedTexts.length
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Chat error" }, { status: 500 });
  }
}
