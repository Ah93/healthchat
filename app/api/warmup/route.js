// Warmup endpoint to pre-load the embedding model
import { generateEmbedding } from "../../../lib/embedding";

export async function GET() {
  try {
    console.log("Warmup: Loading embedding model...");
    await generateEmbedding("test"); // Pre-load model into cache
    console.log("Warmup: Model loaded successfully");
    return Response.json({ 
      status: "warm", 
      message: "Model loaded successfully" 
    });
  } catch (error) {
    console.error("Warmup failed:", error);
    return Response.json({ 
      status: "cold", 
      error: error.message 
    }, { status: 500 });
  }
}

