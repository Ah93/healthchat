// Pinecone client setup
// lib/pinecone.js
import { Pinecone } from "@pinecone-database/pinecone";

let pinecone;

export function getPineconeClient() {
  // Check if API key is available (prevents build errors)
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("Pinecone API key not configured. Please set PINECONE_API_KEY environment variable.");
  }

  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pinecone;
}
