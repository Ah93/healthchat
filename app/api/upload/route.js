//Handles PDF/DOCX upload
import formidable from "formidable";
import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/build/pdf.js";
import { createRequire } from "module";
import mammoth from "mammoth";
import { generateEmbedding, chunkText } from "../../../lib/embedding";
import { getPineconeClient } from "../../../lib/pinecone";

export async function POST(request) {
  // Ensure Node runtime and configure pdf.js worker for server environment
  const require = createRequire(import.meta.url);
  try {
    const workerSrc = require.resolve("pdfjs-dist/build/pdf.worker.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    // Configure standard font data URL to prevent font fetching warnings
    pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = "https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/";
  } catch (_) {}
  const url = new URL(request.url);
  const useLocal = url.searchParams.get("local") === "1" || url.searchParams.get("local") === "true";

  if (useLocal) {
    try {
      const pdfPath = path.join(process.cwd(), "who_health_monitoring_policy.pdf");
      if (!fs.existsSync(pdfPath)) {
        return Response.json({ error: "Local PDF not found" }, { status: 404 });
      }

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

      const pages = pageTexts.length ? pageTexts : [""];

      const client = getPineconeClient();
      const index = client.Index(process.env.PINECONE_INDEX);

      let vectors = [];
      for (let p = 0; p < pages.length; p++) {
        const pageText = pages[p];
        const chunks = chunkText(pageText);
        for (let i = 0; i < chunks.length; i++) {
          const chunkTextValue = chunks[i];
          const embedding = await generateEmbedding(chunkTextValue);
          vectors.push({
            id: `who_health_monitoring_policy.pdf-page-${p + 1}-chunk-${i}`,
            values: embedding,
            metadata: {
              text: chunkTextValue,
              source: "who_health_monitoring_policy.pdf",
              page: p + 1,
            },
          });
        }
      }

      if (vectors.length === 0) {
        return Response.json({ 
          message: "Local PDF processed but no text content found to ingest.", 
          warning: "The PDF may be image-based or contain no extractable text."
        });
      }

      await index.upsert(vectors);

      return Response.json({ message: "Local PDF processed & stored" });
    } catch (error) {
      console.error(error);
      return Response.json({ error: "Error processing local PDF" }, { status: 500 });
    }
  }

  // Handle file upload
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const fileBuffer = await file.arrayBuffer();
    let text = "";
    let pages = [];

    if (file.name.endsWith(".pdf")) {
      // Configure pdf.js worker for Node.js using local module resolution
      const require = createRequire(import.meta.url);
      try {
        const workerSrc = require.resolve("pdfjs-dist/build/pdf.worker.js");
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        // Configure standard font data URL to prevent font fetching warnings
        pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = "https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/";
      } catch (_) {}

      const uint8Data = new Uint8Array(fileBuffer);
      const pdfDocument = await pdfjsLib.getDocument({ data: uint8Data }).promise;
      
      const pageTexts = [];
      let fullText = "";
      
      // Extract text from each page
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ").trim();
        if (pageText.length > 0) {
          pageTexts.push(pageText);
          fullText += pageText + "\n\n";
        }
      }
      
      text = fullText;
      pages = pageTexts.length ? pageTexts : [fullText];
    } else if (file.name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) });
      text = result.value;
      pages = [text];
    } else {
      return Response.json({ error: "Unsupported file format" }, { status: 400 });
    }

    // Chunk and embed (page-aware)
    const client = getPineconeClient();
    const index = client.Index(process.env.PINECONE_INDEX);

    let vectors = [];
    for (let p = 0; p < pages.length; p++) {
      const pageText = pages[p];
      const chunks = chunkText(pageText);
      for (let i = 0; i < chunks.length; i++) {
        const chunkTextValue = chunks[i];
        const embedding = await generateEmbedding(chunkTextValue);
        vectors.push({
          id: `${file.name}-page-${p + 1}-chunk-${i}`,
          values: embedding,
          metadata: { text: chunkTextValue, source: file.name, page: p + 1 },
        });
      }
    }

    if (vectors.length === 0) {
      return Response.json({ 
        message: "File processed but no text content found to ingest.", 
        warning: "The PDF may be image-based or contain no extractable text."
      });
    }

    await index.upsert(vectors);

    return Response.json({ message: "File processed & stored" });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Error processing file" }, { status: 500 });
  }
}
