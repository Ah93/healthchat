"use client";
// Professional Health Chat Interface
import { useEffect, useState, useRef } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chunkedTexts, setChunkedTexts] = useState<Array<{
    chunkNumber: number;
    page: string | number;
    source: string;
    text: string;
    textLength: number;
    textPreview: string;
  }>>([]);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
    // Ensure smooth transition without flash
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    // Cleanup function to abort any pending requests
    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
      isPausedRef.current = false;
    };
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, streamingMessage]);

  // Prevent flash by checking both client and loading states
  if (!isClient || isLoading) {
    return (
      <div className="flex flex-col h-screen bg-white text-black items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-4 mx-auto">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-medium text-black mb-2">HealthChat</h2>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  // Typing animation function
  const typeText = (text: string, onComplete: () => void) => {
    let index = 0;
    setStreamingMessage("");
    setIsGenerating(true);
    isPausedRef.current = false; // Reset paused state when starting
    
    const timer = setInterval(() => {
      // Check if generation was stopped using ref
      if (isPausedRef.current) {
        clearInterval(timer);
        typingTimerRef.current = null;
        return;
      }
      
      if (index < text.length) {
        setStreamingMessage(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
        setIsGenerating(false);
        typingTimerRef.current = null;
        onComplete();
      }
    }, 20); // Adjust speed as needed
    
    typingTimerRef.current = timer;
    return timer;
  };

  // Clean text formatting
  const cleanText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold** formatting
      .replace(/\*(.*?)\*/g, '$1') // Remove *italic* formatting
      .replace(/##\s*/g, '') // Remove ## headers
      .replace(/#\s*/g, '') // Remove # headers
      .replace(/###\s*/g, '') // Remove ### headers
      .replace(/####\s*/g, '') // Remove #### headers
      .replace(/^\s*[-*]\s*/gm, '• ') // Convert - and * to bullet points
      .replace(/\n\s*\n/g, '\n\n') // Clean up multiple newlines
      .trim();
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    
    console.log("askQuestion called with:", question);
    
    const now = new Date();
    const userMessage = {
      id: `user-${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user' as const,
      content: question,
      timestamp: now
    };
    
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setQuestion("");
    
    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Chat request failed");
      }

      const data = await res.json();
      
      if (!data?.answer) {
        throw new Error("No answer returned from server");
      }
      
      const cleanedAnswer = cleanText(data.answer);
      
      // Start typing animation
      typeText(cleanedAnswer, () => {
        // Animation complete, add to messages
        const assistantMessage = {
          id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'assistant' as const,
          content: cleanedAnswer,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setStreamingMessage("");
      });
      
      setChunkedTexts(data.chunkedTexts || []);
    } catch (err) {
      // Check if the request was aborted (user clicked stop)
      if (err instanceof Error && err.name === 'AbortError') {
        // Don't add a message for user-initiated stops - this is expected behavior
        console.log("Chat request aborted by user");
        return;
      }
      
      // Only log actual errors, not aborted requests
      console.error("Error in askQuestion:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      
      const errorMessage = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant' as const,
        content: `Error: ${message}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setIsGenerating(false);
      setIsPaused(false);
      isPausedRef.current = false;
      abortControllerRef.current = null;
      typingTimerRef.current = null;
    }
  };

  // Stop chat function
  const stopChat = () => {
    // Stop HTTP request if it's still ongoing
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
        console.log("HTTP request stopped by user");
      } catch (error) {
        // This is expected - the abort controller might already be cleaned up
        console.log("HTTP request already stopped or completed");
      }
    }
    
    // Stop typing animation if it's ongoing
    if (typingTimerRef.current) {
      isPausedRef.current = true; // Set paused flag
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
      console.log("Typing animation stopped by user");
      
      // If we have partial streaming message, save it as a complete message
      if (streamingMessage.trim()) {
        const stoppedMessage = {
          id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'assistant' as const,
          content: streamingMessage,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, stoppedMessage]);
        setStreamingMessage("");
      }
    }
    
    // Reset states but keep the partial message if any
    setLoading(false);
    setIsGenerating(false);
    setIsPaused(true);
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-medium text-black">HealthChat</h1>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-white px-6 py-6">
        <div className="max-w-4xl mx-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-2xl font-medium text-black mb-3">Welcome to HealthChat</h2>
            <p className="text-gray-600 max-w-md mb-8">
              Your intelligent health assistant powered by WHO guidelines. Ask questions about health monitoring policies, essential medicines, and regulatory frameworks.
            </p>
            
            {/* Suggestion Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full">
              <div 
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors text-left"
                onClick={(e) => {
                  e.preventDefault();
                  setQuestion("What are the WHO guidelines for essential medicines?");
                  // Focus on the input field after setting the question
                  setTimeout(() => {
                    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                    if (input) input.focus();
                  }, 100);
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <h3 className="font-medium text-black mb-2">Essential Medicines</h3>
                <p className="text-sm text-gray-600">Learn about WHO's list of essential medicines and their guidelines</p>
              </div>
              
              <div 
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors text-left"
                onClick={(e) => {
                  e.preventDefault();
                  setQuestion("What are the health monitoring policies recommended by WHO?");
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <h3 className="font-medium text-black mb-2">Health Monitoring</h3>
                <p className="text-sm text-gray-600">Explore WHO's health monitoring and surveillance policies</p>
              </div>
              
              <div 
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors text-left"
                onClick={(e) => {
                  e.preventDefault();
                  setQuestion("What are the data regulation requirements for health data?");
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <h3 className="font-medium text-black mb-2">Data Regulations</h3>
                <p className="text-sm text-gray-600">Understand health data protection and regulatory requirements</p>
              </div>
              
              <div 
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors text-left"
                onClick={(e) => {
                  e.preventDefault();
                  setQuestion("What medicines are recommended for children?");
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <h3 className="font-medium text-black mb-2">Pediatric Medicines</h3>
                <p className="text-sm text-gray-600">Find information about essential medicines for children</p>
              </div>
              
              <div 
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors text-left"
                onClick={(e) => {
                  e.preventDefault();
                  setQuestion("What are the WHO statistics and health indicators?");
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <h3 className="font-medium text-black mb-2">Health Statistics</h3>
                <p className="text-sm text-gray-600">Access WHO health statistics and global health indicators</p>
              </div>
              
              <div 
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors text-left"
                onClick={(e) => {
                  e.preventDefault();
                  setQuestion("What mental health guidelines does WHO recommend?");
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <h3 className="font-medium text-black mb-2">Mental Health</h3>
                <p className="text-sm text-gray-600">Learn about WHO's mental health policies and guidelines</p>
              </div>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-6 ${message.type === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
          >
            <div className={`flex max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'} items-start ${message.type === 'user' ? 'space-x-4' : 'space-x-3'}`}>
              {/* Message Content */}
              <div className={`px-4 py-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-black border border-gray-200'
              }`}>
                <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                <div className={`text-xs mt-2 ${
                  message.type === 'user' ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  {isClient ? message.timestamp.toLocaleTimeString() : ''}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Streaming message */}
        {streamingMessage && (
          <div className="mb-6 flex justify-start">
            <div className="flex items-start space-x-3">
              <div className="bg-gray-100 border border-gray-200 px-4 py-3 rounded-lg">
                <div className="whitespace-pre-wrap leading-relaxed text-black">
                  {streamingMessage}
                  <span className="animate-pulse">|</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {loading && !streamingMessage && (
          <div className="mb-6 flex justify-start">
            <div className="bg-gray-100 border border-gray-200 px-4 py-3 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-gray-600">Analyzing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!loading && !isGenerating && question.trim()) askQuestion();
          }}>
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Ask about WHO health guidelines, essential medicines, or monitoring policies..."
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!loading && !isGenerating && question.trim()) {
                        askQuestion();
                      }
                    }
                  }}
                  disabled={loading || isGenerating}
                />
              </div>
              
              {loading || isGenerating ? (
                <button
                  type="button"
                  onClick={stopChat}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!question.trim()}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Send</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

