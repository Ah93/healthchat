// Debug endpoint to show PDF chunking process AND perform ingestion
import fs from "fs";
import path from "path";
import { chunkText, generateEmbedding } from "../../../lib/embedding";
import { getPineconeClient } from "../../../lib/pinecone";
import * as pdfjsLib from "pdfjs-dist/build/pdf.js";
import { createRequire } from "module";
export const runtime = 'edge';
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const pdfName = url.searchParams.get("pdf") || "who_health_monitoring_policy.pdf";
    
    const pdfPath = path.join(process.cwd(), pdfName);
    if (!fs.existsSync(pdfPath)) {
      return Response.json({ error: `PDF not found: ${pdfName}` }, { status: 404 });
    }

    // Configure pdf.js worker for Node.js using local module resolution
    const require = createRequire(import.meta.url);
    try {
      const workerSrc = require.resolve("pdfjs-dist/build/pdf.worker.js");
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      // Configure standard font data URL to prevent font fetching warnings
      pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = "https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/";
    } catch (_) {}

    const fileBuffer = fs.readFileSync(pdfPath);
    const uint8Data = new Uint8Array(fileBuffer);
    const pdfDocument = await pdfjsLib.getDocument({ data: uint8Data }).promise;
    
    let fullText = "";
    const pageTexts = [];
    
    // Extract text from each page
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(" ");
      pageTexts.push(pageText);
      fullText += pageText + "\n\n";
    }

    // Use the properly extracted text
    const pages = pageTexts;
    
    // Show chunking for first 3 pages only (to avoid huge response)
    const debugInfo = {
      totalPages: pages.length,
      totalTextLength: fullText.length,
      pages: pages.slice(0, 3).map((pageText, index) => {
        const chunks = chunkText(pageText);
        return {
          pageNumber: index + 1,
          pageTextLength: pageText.length,
          pageTextPreview: pageText.substring(0, 200) + "...",
          chunksCount: chunks.length,
          chunks: chunks.map((chunk, chunkIndex) => ({
            chunkNumber: chunkIndex + 1,
            chunkLength: chunk.length,
            chunkPreview: chunk.substring(0, 100) + "..."
          }))
        };
      })
    };

    return Response.json(debugInfo);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Error processing PDF", details: error.message }, { status: 500 });
  }
}

// POST method for ingestion
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const pdfName = url.searchParams.get("pdf") || "who_health_monitoring_policy.pdf";
    
    console.log(`Starting PDF ingestion for: ${pdfName}`);
    
    const pdfPath = path.join(process.cwd(), pdfName);
    if (!fs.existsSync(pdfPath)) {
      return Response.json({ error: `PDF not found: ${pdfName}` }, { status: 404 });
    }

    // Configure pdf.js worker
    const require = createRequire(import.meta.url);
    try {
      const workerSrc = require.resolve("pdfjs-dist/build/pdf.worker.js");
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      // Configure standard font data URL to prevent font fetching warnings
      pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = "https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/";
    } catch (_) {}

    // Extract text from PDF
    const fileBuffer = fs.readFileSync(pdfPath);
    const uint8Data = new Uint8Array(fileBuffer);
    const pdfDocument = await pdfjsLib.getDocument({ data: uint8Data }).promise;
    
    const pageTexts = [];
    
    // Extract text from each page
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(" ").trim();
      if (pageText.length > 0) {
        pageTexts.push(pageText);
      }
    }

    console.log(`Extracted ${pageTexts.length} pages`);

    // Get Pinecone client
    const client = getPineconeClient();
    const index = client.Index(process.env.PINECONE_INDEX);

    // Process each page and create chunks
    let vectors = [];
    let totalChunks = 0;

    for (let p = 0; p < pageTexts.length; p++) {
      const pageText = pageTexts[p];
      const chunks = chunkText(pageText);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkTextValue = chunks[i];
        console.log(`Generating embedding for page ${p + 1}, chunk ${i + 1}...`);
        
        try {
          // Add timeout to embedding generation
          const embeddingPromise = generateEmbedding(chunkTextValue);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Embedding timeout')), 30000)
          );
          
          const embedding = await Promise.race([embeddingPromise, timeoutPromise]);
          
          vectors.push({
            id: `${pdfName}-page-${p + 1}-chunk-${i}`,
            values: embedding,
            metadata: {
              text: chunkTextValue,
              source: pdfName,
              page: p + 1,
            },
          });
          totalChunks++;
        } catch (error) {
          console.error(`Error generating embedding for page ${p + 1}, chunk ${i + 1}:`, error);
          // Skip this chunk and continue
          continue;
        }
      }
    }

    if (vectors.length === 0) {
      return Response.json({ 
        message: "PDF processed but no text content found to ingest.", 
        totalPages: pageTexts.length,
        totalChunks: 0,
        vectorsStored: 0,
        warning: "The PDF may be image-based or contain no extractable text."
      });
    }

    console.log(`Upserting ${vectors.length} vectors to Pinecone...`);
    await index.upsert(vectors);

    return Response.json({ 
      message: "PDF successfully ingested!", 
      totalPages: pageTexts.length,
      totalChunks: totalChunks,
      vectorsStored: vectors.length
    });

  } catch (error) {
    console.error("Ingestion error:", error);
    return Response.json({ error: "Error during ingestion", details: error.message }, { status: 500 });
  }
}
