// Pinecone client setup
// lib/pinecone.js
import { Pinecone } from "@pinecone-database/pinecone";

let pinecone;

export function getPineconeClient() {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pinecone;
}
