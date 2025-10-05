"use client";
// PDF Ingestion Management Page
import { useState, useRef } from "react";

export default function DebugChunksPage() {
  const [ingesting, setIngesting] = useState(false);
  const [ingestionStatus, setIngestionStatus] = useState("");
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [selectedPdf, setSelectedPdf] = useState("who_health_monitoring_policy.pdf");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useUploadMode, setUseUploadMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const availablePdfs = [
    "who_health_monitoring_policy.pdf",
    "2025_who_data_regulation.pdf", 
    "2025_who_statistic.pdf",
    "e2_list_of_essential_medicines.pdf",
    "list_of_essential_medicines_for_children.pdf",
    "list_of_essential_medicines.pdf",
    "list_of_essential_medicines2.pdf",
    "mental_health.pdf",
    "mental_health2.pdf"
  ];

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).filter(file => 
        file.type === 'application/pdf' || file.name.endsWith('.pdf')
      );
      setUploadedFiles(prev => [...prev, ...newFiles]);
      if (newFiles.length > 0 && !selectedFile) {
        setSelectedFile(newFiles[0]);
      }
    }
  };

  // Remove file from uploaded files
  const removeFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(file => file.name !== fileName));
    if (selectedFile?.name === fileName) {
      setSelectedFile(uploadedFiles.find(file => file.name !== fileName) || null);
    }
  };

  // Manual ingestion function
  const runIngestion = async () => {
    if (useUploadMode) {
      // Upload mode - use uploaded file
      if (!selectedFile) {
        setIngestionStatus("❌ Please select a file to ingest");
        return;
      }

      setIngesting(true);
      setIngestionStatus("Starting ingestion...");
      
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        const data = await res.json();
        
        if (res.ok) {
          setIngestionStatus(`✅ ${data.message} - File "${selectedFile.name}" processed and stored in Pinecone`);
          sessionStorage.setItem("ingested_pdf", "1");
        } else {
          setIngestionStatus(`❌ Error: ${data.error}`);
        }
      } catch (err) {
        setIngestionStatus(`❌ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setIngesting(false);
      }
    } else {
      // Fixed PDF mode - use ingesting API
      setIngesting(true);
      setIngestionStatus("Starting ingestion...");
      try {
        const res = await fetch(`/api/ingesting?pdf=${encodeURIComponent(selectedPdf)}`, { method: "POST" });
        const data = await res.json();
        
        if (res.ok) {
          setIngestionStatus(`✅ ${data.message} - ${data.totalChunks} chunks stored in Pinecone`);
          sessionStorage.setItem("ingested_pdf", "1");
        } else {
          setIngestionStatus(`❌ Error: ${data.error}`);
        }
      } catch (err) {
        setIngestionStatus(`❌ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setIngesting(false);
      }
    }
  };

  // Get debug info (chunking preview)
  const getDebugInfo = async () => {
    if (useUploadMode) {
      if (!selectedFile) {
        setIngestionStatus("❌ Please select a file first");
        return;
      }
      
      setIngestionStatus("⚠️ Debug preview is not available for uploaded files. Use 'Ingest PDF to Pinecone' to process the file.");
      return;
    }
    
    // Fixed PDF mode - use ingesting API for detailed preview
    try {
      const res = await fetch(`/api/ingesting?pdf=${encodeURIComponent(selectedPdf)}`);
      const data = await res.json();
      setDebugInfo(data);
    } catch (err) {
      console.error("Error getting debug info:", err);
      setIngestionStatus("❌ Error getting debug info");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">📊 PDF Ingestion Management</h1>
            <p className="text-slate-400">Process and ingest WHO health documents into the knowledge base</p>
          </div>
          <a 
            href="/" 
            className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Back to Chat</span>
          </a>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
      
      {/* Ingestion Section */}
      <div className="mb-8 p-6 bg-slate-800 border border-slate-700 rounded-xl">
        <h2 className="text-xl font-semibold mb-4 text-white">Step 1: Select and Ingest PDF to Pinecone</h2>
        
        {/* Mode Toggle */}
        <div className="mb-6">
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => setUseUploadMode(false)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                !useUploadMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Use Fixed PDFs (Recommended)
            </button>
            <button
              onClick={() => setUseUploadMode(true)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                useUploadMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Upload Custom PDFs
            </button>
          </div>
        </div>

        {!useUploadMode ? (
          /* Fixed PDF Selection */
          <div className="mb-4">
            <label htmlFor="pdf-select" className="block text-sm font-medium text-slate-300 mb-2">
              Select PDF to process:
            </label>
            <select
              id="pdf-select"
              value={selectedPdf}
              onChange={(e) => setSelectedPdf(e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availablePdfs.map((pdf) => (
                <option key={pdf} value={pdf}>
                  {pdf}
                </option>
              ))}
            </select>
          </div>
        ) : (
          /* File Upload Section */
          <div className="mb-6">
            <label htmlFor="file-upload" className="block text-sm font-medium text-slate-300 mb-2">
              Upload PDF files:
            </label>
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              accept=".pdf"
              multiple
              onChange={handleFileUpload}
              className="w-full max-w-md px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-slate-400 mt-1">You can select multiple PDF files at once</p>
          </div>
        )}

        {/* Uploaded Files List - Only show in upload mode */}
        {useUploadMode && uploadedFiles.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Uploaded Files:</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-700 p-2 rounded border border-slate-600">
                  <span className="text-sm text-slate-200 truncate flex-1">{file.name}</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="selectedFile"
                      checked={selectedFile?.name === file.name}
                      onChange={() => setSelectedFile(file)}
                      className="text-blue-500"
                    />
                    <button
                      onClick={() => removeFile(file.name)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Selection - Only show in upload mode */}
        {useUploadMode && uploadedFiles.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select file to process:
            </label>
            {selectedFile ? (
              <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
                <span className="text-slate-200 font-medium">{selectedFile.name}</span>
                <span className="text-slate-400 text-sm ml-2">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No file selected</p>
            )}
          </div>
        )}
        
        <p className="text-slate-400 mb-4">
          This will chunk the selected PDF, generate embeddings, and store them in Pinecone.
        </p>
        
        <div className="flex gap-4 mb-4">
          <button
            onClick={runIngestion}
            disabled={ingesting || (useUploadMode && !selectedFile)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg disabled:opacity-50 hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 flex items-center space-x-2"
          >
            {ingesting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Ingesting...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Ingest PDF to Pinecone</span>
              </>
            )}
          </button>
          
          <button
            onClick={getDebugInfo}
            disabled={ingesting}
            className="px-6 py-3 bg-slate-700 text-white rounded-lg disabled:opacity-50 hover:bg-slate-600 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Preview Chunking</span>
          </button>
        </div>
        
        {ingestionStatus && (
          <div className="p-4 bg-slate-700 rounded-lg border border-slate-600">
            <p className="text-sm font-mono text-slate-100">{ingestionStatus}</p>
          </div>
        )}
      </div>

      {/* Debug Info Section */}
      {debugInfo && (
        <div className="mb-8 p-6 bg-slate-800 border border-slate-700 rounded-xl">
          <h2 className="text-xl font-semibold mb-4 text-white">📋 Chunking Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-700 p-4 rounded-lg border border-slate-600">
              <h3 className="font-semibold text-blue-400 mb-2">Total Pages</h3>
              <p className="text-2xl font-bold text-white">{debugInfo.totalPages}</p>
            </div>
            <div className="bg-slate-700 p-4 rounded-lg border border-slate-600">
              <h3 className="font-semibold text-green-400 mb-2">Total Text Length</h3>
              <p className="text-2xl font-bold text-white">{debugInfo.totalTextLength.toLocaleString()} chars</p>
            </div>
            <div className="bg-slate-700 p-4 rounded-lg border border-slate-600">
              <h3 className="font-semibold text-purple-400 mb-2">Sample Chunks</h3>
              <p className="text-2xl font-bold text-white">{debugInfo.pages[0]?.chunksCount || 0}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {debugInfo.pages.map((page: any, index: number) => (
              <div key={index} className="bg-slate-700 p-4 rounded-lg border border-slate-600">
                <h3 className="font-semibold mb-2 text-white">Page {page.pageNumber}</h3>
                <p className="text-sm text-slate-400 mb-2">
                  Length: {page.pageTextLength} chars | Chunks: {page.chunksCount}
                </p>
                <p className="text-sm mb-3 text-slate-300">{page.pageTextPreview}</p>
                
                <div className="space-y-2">
                  {page.chunks.map((chunk: any, chunkIndex: number) => (
                    <div key={chunkIndex} className="bg-slate-600 p-3 rounded text-xs">
                      <span className="font-semibold text-slate-200">Chunk {chunk.chunkNumber}:</span> 
                      <span className="text-slate-300 ml-1">{chunk.chunkPreview}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
