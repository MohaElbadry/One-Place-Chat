'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { getApiUrl } from '@/config/environment';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Upload, Send, X, Check } from 'lucide-react';

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
      <div className="mt-3 p-3 bg-info/10 border-l-4 border-info rounded-r-lg">
        <div className="text-sm font-medium text-foreground">
          <span className="inline text-base font-bold text-info">Tool Detected: </span> {toolMatch.tool.name}
        </div>
      </div>

    );
  }, []);

  // Improved clarification rendering
  const renderClarificationRequest = useCallback((clarificationRequest: any) => {
    if (!clarificationRequest) return null;

    return (
      <div className="mt-3 p-3 bg-warning/10 border-l-4 border-warning rounded-r-lg">
        <div className="text-sm text-foreground">
          <div className="font-medium">❓ {clarificationRequest.message}</div>
          {clarificationRequest.missingFields && (
            <div className="mt-2 text-xs">
              <span className="font-medium">Missing information:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {clarificationRequest.missingFields.map((field: any, index: number) => (
                  <span
                    key={index}
                    className={`px-2 py-1 rounded text-xs font-medium ${field.type === 'required'
                      ? 'bg-destructive/20 text-destructive'
                      : 'bg-info/20 text-info'
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
        <div className="relative max-w-full overflow-hidden rounded-lg my-2">
          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
            className="rounded-lg text-sm !overflow-x-auto font-code"
            wrapLines={true}
            wrapLongLines={true}
            customStyle={{
              margin: 0,
              padding: '1rem',
              maxWidth: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              fontFamily: 'JetBrains Mono, Fira Code, Monaco, Consolas, monospace',
              fontSize: '0.85rem',
              lineHeight: '1.6'
            }}
            codeTagProps={{
              style: {
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }
            }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className="bg-muted text-destructive px-1.5 py-0.5 rounded text-sm font-mono break-all inline-block max-w-full overflow-wrap-anywhere" {...props}>
          {children}
        </code>
      );
    },

    p: ({ children }: any) => <p className="mb-3 last:mb-0 break-words overflow-hidden">{children}</p>,
    h1: ({ children }: any) => <h1 className="text-xl font-bold mb-3 text-foreground break-words">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 text-foreground break-words">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-md font-semibold mb-2 text-foreground break-words">{children}</h3>,
    ul: ({ children }: any) => <ul className="list-disc ml-6 mb-3 space-y-1 break-words">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal ml-6 mb-3 space-y-1 break-words">{children}</ol>,
    li: ({ children }: any) => <li className="text-foreground/90 break-words">{children}</li>,
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-border pl-4 my-3 italic text-muted-foreground break-words">
        {children}
      </blockquote>
    ),
    pre: ({ children }: any) => (
      <pre className="bg-foreground text-background p-4 rounded-lg overflow-x-auto max-w-full whitespace-pre-wrap break-words text-sm mb-3">
        {children}
      </pre>
    ),
    strong: ({ children }: any) => <strong className="font-semibold text-foreground break-words">{children}</strong>,
    em: ({ children }: any) => <em className="italic text-foreground/90 break-words">{children}</em>,
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
          <div className={`max-w-[80%] min-w-0 overflow-hidden ${isUser ? 'order-2' : 'order-1'}`}>
            {/* Message bubble */}
            <div className={`rounded-2xl px-5 py-4 overflow-hidden ${isUser
              ? 'bg-primary/30 border border-primary/20 text-foreground rounded-br-sm shadow-md'
              : 'bg-muted/80 border border-border text-foreground rounded-bl-sm shadow-sm'
              }`}>
              {/* Timestamp and role */}
              <div className={`text-xs mb-3 font-medium ${isUser ? 'text-info' : 'text-muted-foreground'
                }`}>
                <span className="font-semibold text-muted-foreground font-poppins">{isUser ? 'You' : 'Assistant'}</span>
                <span className="mx-2 opacity-60">•</span>
                <span className="font-code text-accent">{formatMessageTime(message.timestamp)}</span>
              </div>

              {/* Message content */}
              <div className={`${isUser ? 'text-foreground' : 'text-foreground'} break-words overflow-hidden`}>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleMessageExpansion(message.id)}
                  className={`mt-3 h-auto px-3 py-1.5 ${isUser
                    ? 'text-info hover:text-info-foreground hover:bg-info/20'
                    : 'text-primary hover:text-accent hover:bg-accent/10'
                    }`}
                >
                  {expandedMessages.has(message.id) ? 'See less' : 'See more'}
                </Button>
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
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 p-5 bg-card border-b border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-display text-primary">
              {currentConversationId ? 'Conversation' : 'New Conversation'}
            </h2>
            {currentConversationId && (
              <p className="text-sm text-muted-foreground mt-2 font-medium">
                ID: <span className="font-code text-accent">{currentConversationId.substring(0, 8)}...</span>
              </p>
            )}
          </div>

          {/* Upload Tools Button */}
          <Button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-medium hover:shadow-lg font-medium text-sm"
            title="Upload OpenAPI specification to generate tools"
          >
            <Upload className="w-4 h-4" />
            Upload Tools
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {messages.length === 0 && !currentConversationId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl mb-6">💬</div>
              <div className="text-2xl font-display text-primary mb-3">Start a new conversation</div>
              <div className="text-base text-muted-foreground font-medium font-poppins">Type your message below to begin chatting</div>
              {!currentConversationId && (
                <div className="flex-shrink-0 px-4 pt-4 pb-2 border-border/60">
                  <div className="mb-3 flex flex-col gap-2 ">
                    <Button
                      variant="outline"
                      onClick={() => setInputValue("Get a JSON response from an API")}
                      className="px-3 py-2 text-sm font-medium text-primary bg-card border border-primary/20 rounded-lg hover:bg-primary/10 hover:border-primary/30 transition-smooth"
                    >
                      Get a JSON response
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setInputValue("Get a pet by ID 5")}
                      className="px-3 py-2 text-sm font-medium text-foreground bg-card border border-secondary/20 rounded-lg hover:bg-secondary/50 hover:border-secondary/30 transition-smooth"
                    >
                      Get a pet by ID
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setInputValue("Find pets by status available")}
                      className="px-3 py-2 text-sm font-medium text-foreground bg-card border border-accent/20 rounded-lg hover:bg-accent/50 hover:border-accent/30 transition-smooth"
                    >
                      Find pets by status
                    </Button>
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
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex space-x-1">
                    <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2.5 h-2.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2.5 h-2.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm font-medium">Assistant is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>



      {/* Input Area */}
      <div className="flex-shrink-0 p-4 bg-card border-t border-border">
        <div className="flex gap-3 items-center">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your message here..."
            className="flex-1 p-4 border border-border rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[48px] max-h-32 text-foreground overflow-y-auto font-medium text-base leading-relaxed bg-muted"
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
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-6 py-3 bg-success hover:bg-success/90 text-success-foreground rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 transition-smooth shadow-medium hover:shadow-lg font-semibold text-base"
          >
            Send
            {isLoading ? (
              <div className="w-4 h-4 border-2  border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Upload Tools Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-white rounded-3xl px-8 py-6 max-w-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-gray-900">Upload Open API Specification</DialogTitle>
          </DialogHeader>

          {/* Upload Area */}
          <div className="mb-6">
            {uploadStatus === 'idle' && (
              <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/50 transition-colors">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>

                <h4 className="text-lg font-semibold text-foreground mb-2">Upload OpenAPI JSON File</h4>
                <p className="text-muted-foreground mb-4">
                  Upload a JSON file containing your OpenAPI/Swagger specification to generate tools
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold transition-smooth shadow-medium"
                >
                  Choose File
                </Button>

                <p className="text-xs text-muted-foreground mt-3">
                  Supported formats: JSON files with OpenAPI 3.0 or Swagger 2.0 specifications
                </p>
              </div>
            )}

            {/* File Selected */}
            {uploadedFile && uploadStatus === 'idle' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-green-900">{uploadedFile.name}</h5>
                    <p className="text-sm text-green-700">
                      {(uploadedFile.size / 1024).toFixed(1)} KB • Ready to upload
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setUploadedFile(null);
                      setUploadError('');
                    }}
                    className="h-8 w-8 text-green-600 hover:text-green-800 rounded-full hover:bg-green-100"
                  >
                    <X className="w-4 h-4" />
                  </Button>
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

                <Progress value={uploadProgress} className="h-2" />
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
              <Button
                onClick={handleUpload}
                className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-smooth shadow-medium"
              >
                Upload & Generate Tools
              </Button>
            )}

            {uploadStatus === 'success' && (
              <Button
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadState();
                }}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-smooth shadow-medium"
              >
                Done
              </Button>
            )}

            {uploadStatus === 'error' && (
              <Button
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadState();
                }}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-smooth shadow-medium"
              >
                Close
              </Button>
            )}

            {(uploadStatus === 'idle' || uploadStatus === 'success' || uploadStatus === 'error') && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadState();
                }}
                className="px-6 py-3 text-muted-foreground bg-muted hover:bg-muted/80 rounded-xl font-medium transition-smooth"
              >
                Cancel
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
