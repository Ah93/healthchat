// Embedding generator
// lib/embedding.js
import { pipeline } from "@xenova/transformers";

// Singleton for embedding model
let embedder = null;

export async function generateEmbedding(text) {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data); // Convert tensor to plain array
}

// Token-based chunking function (roughly 600-750 tokens)
export function chunkText(text, chunkSize = 800, overlap = 100) {
  // Rough estimation: 1 token ≈ 0.75 words for English
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const chunk = words.slice(start, start + chunkSize).join(" ");
    if (chunk.trim().length > 0) { // Only add non-empty chunks
      chunks.push(chunk);
    }
    start += chunkSize - overlap;
  }
  return chunks;
}
