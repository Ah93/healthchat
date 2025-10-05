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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    // Ensure smooth transition without flash
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
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
    
    const timer = setInterval(() => {
      if (index < text.length) {
        setStreamingMessage(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
        onComplete();
      }
    }, 20); // Adjust speed as needed
    
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
    
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
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
    }
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
            <p className="text-gray-600 max-w-md">
              Your intelligent health assistant powered by WHO guidelines. Ask questions about health monitoring policies, essential medicines, and regulatory frameworks.
            </p>
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
          <div className="flex space-x-4">
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
                    if (!loading && question.trim()) askQuestion();
                  }
                }}
                disabled={loading}
              />
            </div>
            <button
              onClick={askQuestion}
              disabled={loading || !question.trim()}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
