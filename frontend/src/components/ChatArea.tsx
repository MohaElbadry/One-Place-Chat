'use client';

import { useRef, useEffect } from 'react';

interface ChatAreaProps {
  message: string;
  setMessage: (message: string) => void;
  onSendMessage: () => void;
  onQuickAction: (actionText: string) => void;
  selectedConversationId?: string;
}

export default function ChatArea({ 
  message, 
  setMessage, 
  onSendMessage, 
  onQuickAction,
  selectedConversationId 
}: ChatAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  };

  const quickActions = [
    { text: "Show me all available pets", color: "text-blue-400" },
    { text: "Create a new pet named Fluffy", color: "text-green-400" },
    { text: "Upload API documentation", color: "text-purple-400" },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="bg-dark-800 border-b border-dark-600 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Chat</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Tools</span>
            <button className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-3">
            Welcome to One-Place-Chat
          </h3>
          <p className="text-gray-400 mb-6">
            Start a conversation by typing a message below. You can ask me to interact with any API using natural language.
          </p>
          
          {/* Quick Action Buttons */}
          <div className="space-y-2">
            {quickActions.map((action, index) => (
              <button 
                key={index}
                onClick={() => onQuickAction(action.text)}
                className="w-full bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-gray-500 rounded-lg p-3 text-left transition-all duration-200 text-sm"
              >
                <span className={action.color}>"{action.text}"</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t border-dark-600 p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea 
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here..." 
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px] max-h-32"
              rows={1}
            />
            <button className="absolute right-3 bottom-3 p-1 text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
              </svg>
            </button>
          </div>
          <button 
            onClick={onSendMessage}
            className="gradient-border"
          >
            <div className="gradient-border-content px-6 py-3 flex items-center gap-2 text-white font-medium hover:bg-dark-600 transition-colors">
              <span>Send</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
