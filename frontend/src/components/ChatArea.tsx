'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { getApiUrl } from '@/config/environment';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolMatch?: any;
  needsClarification?: boolean;
  clarificationRequest?: any;
}

interface ChatAreaProps {
  selectedConversationId: string | null;
  onConversationUpdate?: (conversation: any) => void;
  refreshTools?: () => void;
}

export default function ChatArea({ selectedConversationId, onConversationUpdate, refreshTools }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversation when selectedConversationId changes
  useEffect(() => {
    if (selectedConversationId) {
      loadConversation(selectedConversationId);
    } else {
      // Start new conversation
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [selectedConversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      const result = await apiClient.getConversation(conversationId);

      if (result) {
        setCurrentConversationId(conversationId);
        setMessages(result.messages || []);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      // Add error message to UI
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        content: '**Error:** Failed to load conversation. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages([errorMessage]);
    }
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);



    // Add user message to UI immediately
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, newUserMessage]);

    try {
      // Prepare request payload
      const payload: any = {
        message: userMessage
      };

      // Add conversationId if we have one
      if (currentConversationId) {
        payload.conversationId = currentConversationId;
      }

      const response = await fetch(`${getApiUrl()}/conversations/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        // Update conversation ID if this is a new conversation
        if (result.data.isNewConversation) {
          setCurrentConversationId(result.data.conversationId);
        }

        // Add assistant response to UI
        const assistantMessage: Message = {
          id: Date.now().toString() + '-assistant',
          role: 'assistant',
          content: result.data.assistantResponse.content,
          timestamp: result.data.assistantResponse.timestamp,
          toolMatch: result.data.assistantResponse.toolMatch,
          needsClarification: result.data.assistantResponse.needsClarification,
          clarificationRequest: result.data.assistantResponse.clarificationRequest
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Notify parent component about conversation update
        if (onConversationUpdate) {
          onConversationUpdate(result.data.conversation);
        }
      } else {
        // Handle error
        const errorMessage: Message = {
          id: Date.now().toString() + '-error',
          role: 'assistant',
          content: `**Error:** ${result.error || 'Failed to process message'}`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        content: '**Error:** Failed to connect to server',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, currentConversationId, onConversationUpdate]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // File upload handlers
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setUploadedFile(file);
        setUploadError('');
      } else {
        setUploadError('Please select a valid JSON file');
      }
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!uploadedFile) return;

    try {
      setUploadStatus('uploading');
      setUploadProgress(0);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Create FormData and upload
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch(`${getApiUrl()}/tools/upload`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
      }

      setUploadStatus('processing');
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setUploadStatus('success');
      
      // Refresh tools list if parent component provides callback
      if (refreshTools) {
        refreshTools();
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    }
  }, [uploadedFile, refreshTools]);

  const resetUploadState = useCallback(() => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadedFile(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const toggleMessageExpansion = useCallback((messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  const formatMessageTime = useMemo(() => (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Check if message content is long (more than 30 lines)
  const isLongMessage = useCallback((content: string) => {
    const lines = content.split('\n');
    return lines.length > 20;
  }, []);

  // Truncate message content for display
  const truncateMessage = useCallback((content: string, messageId: string) => {
    if (!isLongMessage(content)) {
      return { content, isTruncated: false };
    }

    const lines = content.split('\n');
    const isExpanded = expandedMessages.has(messageId);

    if (isExpanded) {
      return { content, isTruncated: false };
    }
    // Check if message content is long (more than 30 lines)
    const truncatedContent = lines.slice(0, 20).join('\n') + '\n...';
    return { content: truncatedContent, isTruncated: true };
  }, [isLongMessage, expandedMessages]);

  // Tool info as a styled component - rendered separately from Markdown
  const renderToolInfo = useCallback((toolMatch: any) => {
    if (!toolMatch) return null;

    return (
      <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
        <div className="text-sm font-medium text-blue-800">
          <p className=' inline text-base font-bold text-primary'> Tool Detected : </p> {toolMatch.tool.name}
        </div>
      </div>

    );
  }, []);

  // Improved clarification rendering
  const renderClarificationRequest = useCallback((clarificationRequest: any) => {
    if (!clarificationRequest) return null;

    return (
      <div className="mt-3 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
        <div className="text-sm text-amber-800">
          <div className="font-medium">❓ {clarificationRequest.message}</div>
          {clarificationRequest.missingFields && (
            <div className="mt-2 text-xs">
              <span className="font-medium">Missing information:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {clarificationRequest.missingFields.map((field: any, index: number) => (
                  <span
                    key={index}
                    className={`px-2 py-1 rounded text-xs font-medium ${field.type === 'required'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                      }`}
                  >
                    {field.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, []);

  // Custom components for ReactMarkdown
  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          className="rounded-lg text-sm !overflow-x-auto !max-w-full font-code"
          wrapLines={true}
          wrapLongLines={true}
          customStyle={{
            maxWidth: '100%',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontFamily: 'JetBrains Mono, Fira Code, Monaco, Consolas, monospace'
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-sm font-mono break-all" {...props}>
          {children}
        </code>
      );
    },

    p: ({ children }: any) => <p className="mb-3 last:mb-0 break-words">{children}</p>,
    h1: ({ children }: any) => <h1 className="text-xl font-bold mb-3 text-gray-900 break-words">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 text-gray-900 break-words">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-md font-semibold mb-2 text-gray-900 break-words">{children}</h3>,
    ul: ({ children }: any) => <ul className="list-disc ml-6 mb-3 space-y-1 break-words">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal ml-6 mb-3 space-y-1 break-words">{children}</ol>,
    li: ({ children }: any) => <li className="text-gray-800 break-words">{children}</li>,
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 my-3 italic text-gray-700 break-words">
        {children}
      </blockquote>
    ),
    pre: ({ children }: any) => (
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto max-w-full whitespace-pre-wrap break-all text-sm mb-3">
        {children}
      </pre>
    ),
    strong: ({ children }: any) => <strong className="font-semibold text-gray-900 break-words">{children}</strong>,
    em: ({ children }: any) => <em className="italic text-gray-800 break-words">{children}</em>,
  }), []);

  // Memoized message rendering with proper left/right alignment
  const renderedMessages = useMemo(() => {
    return messages.map((message) => {
      const isUser = message.role === 'user';
      const isAssistant = message.role === 'assistant';
      const { content: displayContent, isTruncated } = truncateMessage(message.content, message.id);

      // Use original message content without tool info
      const fullContent = displayContent;

      return (
        <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
          <div className={`max-w-[80%] min-w-0 ${isUser ? 'order-2' : 'order-1'}`}>
            {/* Message bubble */}
            <div className={`rounded-2xl px-5 py-4 ${isUser
              ? 'bg-gradient-to-r from-secondary bg-[#B4EBFF] to-orange-500  rounded-br-sm shadow-medium'
              : 'bg-warm-gray border border-gray-200/60 text-gray-800 rounded-bl-sm shadow-soft'
              }`}>
              {/* Timestamp and role */}
              <div className={`text-xs mb-3 font-medium ${isUser ? 'text-blue-100' : 'text-gray-500'
                }`}>
                <span className="font-semibold text-gray-500 font-poppins">{isUser ? 'You' : 'Assistant'}</span>
                <span className="mx-2 opacity-60">•</span>
                <span className="font-code text-accent">{formatMessageTime(message.timestamp)}</span>
              </div>

              {/* Message content */}
              <div className={`${isUser ? 'text-gray-800' : 'text-gray-800'} break-words overflow-hidden`}>
                {isAssistant ? (
                  <div className="prose prose-sm max-w-none overflow-hidden">
                    <ReactMarkdown
                      components={markdownComponents}
                    >
                      {fullContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words overflow-hidden">
                    {fullContent}
                  </div>
                )}
              </div>

              {/* See more/less button for long messages */}
              {isLongMessage(message.content) && (
                <button
                  onClick={() => toggleMessageExpansion(message.id)}
                  className={`mt-3 text-sm font-semibold transition-smooth px-3 py-1.5 rounded-lg ${isUser
                    ? 'text-blue-100 hover:text-white hover:bg-blue-400/20'
                    : 'text-primary hover:text-accent hover:bg-accent/10'
                    }`}
                >
                  {expandedMessages.has(message.id) ? 'See less' : 'See more'}
                </button>
              )}
            </div>

            {/* Tool information and clarification requests */}
            {isAssistant && (
              <div className="mt-2">
                {message.toolMatch && renderToolInfo(message.toolMatch)}
                {message.clarificationRequest && renderClarificationRequest(message.clarificationRequest)}
              </div>
            )}
          </div>
        </div>
      );
    });
  }, [messages, formatMessageTime, markdownComponents, renderToolInfo, renderClarificationRequest, truncateMessage, toggleMessageExpansion, expandedMessages, isLongMessage]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 p-5 bg-warm-gray border-b border-gray-200/60 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-display text-primary">
              {currentConversationId ? 'Conversation' : 'New Conversation'}
            </h2>
            {currentConversationId && (
              <p className="text-sm text-gray-600 mt-2 font-medium">
                ID: <span className="font-code text-accent">{currentConversationId.substring(0, 8)}...</span>
              </p>
            )}
          </div>
          
          {/* Upload Tools Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all shadow-medium hover:shadow-lg font-medium text-sm"
            title="Upload OpenAPI specification to generate tools"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Tools
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {messages.length === 0 && !currentConversationId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl mb-6">💬</div>
              <div className="text-2xl font-display text-primary mb-3">Start a new conversation</div>
              <div className="text-base text-gray-500 font-medium font-poppins">Type your message below to begin chatting</div>
              {!currentConversationId && (
                <div className="flex-shrink-0 px-4 pt-4 pb-2  border-gray-200/60">
                  <div className="mb-3 flex flex-col gap-2 ">
                    <button
                      onClick={() => setInputValue("Get a JSON response from an API")}
                      className="px-3 py-2 text-sm font-medium text-primary bg-white border border-primary/20 rounded-lg hover:bg-primary/20 hover:border-primary/30 transition-smooth"
                    >
                      Get a JSON response
                    </button>
                    <button
                      onClick={() => setInputValue("Get a pet by ID 5")}
                      className="px-3 py-2 text-sm font-medium text-secondary bg-white border border-secondary/20 rounded-lg hover:bg-secondary/20 hover:border-secondary/30 transition-smooth"
                    >
                      Get a pet by ID
                    </button>
                    <button
                      onClick={() => setInputValue("Find pets by status available")}
                      className="px-3 py-2 text-sm font-medium text-accent bg-white border border-accent/20 rounded-lg hover:bg-accent/20 hover:border-accent/30 transition-smooth"
                    >
                      Find pets by status
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {renderedMessages}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[80%]">
              <div className="bg-warm-gray border border-gray-200/60 rounded-2xl rounded-bl-sm px-5 py-4 shadow-soft">
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="flex space-x-1">
                    <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2.5 h-2.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2.5 h-2.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm font-medium font-poppins">Assistant is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>



      {/* Input Area */}
      <div className="flex-shrink-0 p-4 bg-white border-t">
        <div className="flex gap-3 items-center">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            className="flex-1 p-4 border border-gray-300/60 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[48px] max-h-32 text-gray-900 overflow-y-auto font-medium text-base leading-relaxed bg-warm-gray"
            rows={1}
            disabled={isLoading}
            style={{
              resize: 'none',
              overflow: 'hidden',
              height: 'auto',
              minHeight: '48px',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              const newHeight = Math.min(target.scrollHeight, 128);
              target.style.height = newHeight + 'px';

              // Enable scrolling after 4 lines (approximately 88px)
              if (newHeight > 88) {
                target.style.overflowY = 'auto';
              } else {
                target.style.overflowY = 'hidden';
              }
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-6 py-3 bg-gradient-to-r from-success bg-green-600 to-green-50 text-white rounded-2xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 transition-smooth shadow-medium hover:shadow-lg font-semibold text-base"
          >
            
            Send
            {isLoading ? (
              <div className="w-4 h-4 border-2  border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4 rotate-90 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* Upload Tools Modal */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowUploadModal(false)}
        >
          <div 
            className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-display text-gray-900">Upload OpenAPI Specification</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-smooth"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Upload Area */}
            <div className="mb-6">
              {uploadStatus === 'idle' && (
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-primary/50 transition-colors">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Upload OpenAPI JSON File</h4>
                  <p className="text-gray-600 mb-4">
                    Upload a JSON file containing your OpenAPI/Swagger specification to generate tools
                  </p>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-smooth shadow-medium"
                  >
                    Choose File
                  </button>
                  
                  <p className="text-xs text-gray-500 mt-3">
                    Supported formats: JSON files with OpenAPI 3.0 or Swagger 2.0 specifications
                  </p>
                </div>
              )}
              
              {/* File Selected */}
              {uploadedFile && uploadStatus === 'idle' && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-green-900">{uploadedFile.name}</h5>
                      <p className="text-sm text-green-700">
                        {(uploadedFile.size / 1024).toFixed(1)} KB • Ready to upload
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setUploadedFile(null);
                        setUploadError('');
                      }}
                      className="p-2 text-green-600 hover:text-green-800 rounded-full hover:bg-green-100 transition-smooth"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Upload Progress */}
              {uploadStatus === 'uploading' && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-blue-900">Uploading...</h5>
                      <p className="text-sm text-blue-700">Sending file to server</p>
                    </div>
                  </div>
                  
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-blue-700 mt-2 text-center">{uploadProgress}%</p>
                </div>
              )}
              
              {/* Processing Progress */}
              {uploadStatus === 'processing' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-amber-900">Processing...</h5>
                      <p className="text-sm text-amber-700">Generating tools and embeddings</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-amber-700">Parsing OpenAPI specification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-amber-700">Generating tool definitions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-amber-700">Creating embeddings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-amber-700">Storing in ChromaDB</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Success State */}
              {uploadStatus === 'success' && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-green-900">Upload Successful!</h5>
                      <p className="text-sm text-green-700">Tools have been generated and stored</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Error State */}
              {uploadStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-red-900">Upload Failed</h5>
                      <p className="text-sm text-red-700">{uploadError}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              {uploadStatus === 'idle' && uploadedFile && (
                <button
                  onClick={handleUpload}
                  className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-smooth shadow-medium"
                >
                  Upload & Generate Tools
                </button>
              )}
              
              {uploadStatus === 'success' && (
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    resetUploadState();
                  }}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-smooth shadow-medium"
                >
                  Done
                </button>
              )}
              
              {uploadStatus === 'error' && (
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    resetUploadState();
                  }}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-smooth shadow-medium"
                >
                  Close
                </button>
              )}
              
              {(uploadStatus === 'idle' || uploadStatus === 'success' || uploadStatus === 'error') && (
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    resetUploadState();
                  }}
                  className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-smooth"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
