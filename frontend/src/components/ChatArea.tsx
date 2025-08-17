'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolMatch?: any;
  needsClarification?: boolean;
  clarificationRequest?: any;
}

interface ChatAreaProps {
  selectedConversationId: string | null;
  onConversationUpdate?: (conversation: any) => void;
}

export default function ChatArea({ selectedConversationId, onConversationUpdate }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/conversations/${conversationId}`);
      const result = await response.json();
      
      if (result.success) {
        setCurrentConversationId(conversationId);
        setMessages(result.data.messages || []);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const handleSendMessage = async () => {
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

      const response = await fetch('http://localhost:3001/api/conversations/chat', {
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
          content: `Error: ${result.error || 'Failed to process message'}`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        content: 'Error: Failed to connect to server',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    return role === 'user' ? 'You' : 'Assistant';
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderToolInfo = (toolMatch: any) => {
    if (!toolMatch) return null;

    return (
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm text-blue-800">
          <div className="font-semibold">🔧 Tool Detected: {toolMatch.tool.name}</div>
          <div className="text-xs text-blue-600 mt-1">
            📊 Confidence: {(toolMatch.confidence * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-blue-600 mt-1">
            📝 {toolMatch.tool.description}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            🌐 {toolMatch.tool.endpoint.method} {toolMatch.tool.endpoint.path}
          </div>
        </div>
      </div>
    );
  };

  const renderClarificationRequest = (clarificationRequest: any) => {
    if (!clarificationRequest) return null;

    return (
      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-sm text-yellow-800">
          <div className="font-semibold">❓ {clarificationRequest.message}</div>
          {clarificationRequest.missingFields && (
            <div className="mt-2">
              <div className="text-xs font-medium">Missing Information:</div>
              {clarificationRequest.missingFields.map((field: any, index: number) => (
                <div key={index} className="text-xs mt-1">
                  <span className={`px-2 py-1 rounded text-xs ${
                    field.type === 'required' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {field.type === 'required' ? 'Required' : 'Optional'}: {field.name}
                  </span>
                  {field.description && (
                    <span className="text-gray-600 ml-2">- {field.description}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">
          {currentConversationId ? 'Chat' : 'New Conversation'}
        </h2>
        {currentConversationId && (
          <p className="text-sm text-gray-600 mt-1">
            Conversation ID: {currentConversationId.substring(0, 8)}...
          </p>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && !currentConversationId ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-lg font-medium mb-2">Start a new conversation</div>
            <div className="text-sm">Type your message below to begin chatting</div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getRoleColor(message.role)}`}>
                {getRoleLabel(message.role).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">
                    {getRoleLabel(message.role)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatMessageTime(message.timestamp)}
                  </span>
                </div>
                <div className="text-gray-800 whitespace-pre-wrap">
                  {message.content}
                </div>
                
                {/* Render tool information if available */}
                {message.toolMatch && renderToolInfo(message.toolMatch)}
                
                {/* Render clarification request if needed */}
                {message.clarificationRequest && renderClarificationRequest(message.clarificationRequest)}
              </div>
            </div>
          ))
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <div className="w-4 h-4 animate-spin text-gray-600">⏳</div>
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-500">Assistant is thinking...</div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>📤</span>
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
