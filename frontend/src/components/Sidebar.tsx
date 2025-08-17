'use client';

import React from 'react';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  lastActivity: string;
}

interface SidebarProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  onConversationDelete: (conversationId: string) => void;
}

export default function Sidebar({ 
  conversations, 
  selectedConversationId, 
  onConversationSelect,
  onNewConversation,
  onConversationDelete
}: SidebarProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleConversationClick = (conversationId: string) => {
    onConversationSelect(conversationId);
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      onConversationDelete(conversationId);
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">One-Place-Chat</h1>
        </div>
        
        {/* New Conversation Button */}
        <button
          onClick={onNewConversation}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <span className="w-4 h-4">+</span>
          New Conversation
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <span className="w-8 h-8 mx-auto mb-2 text-gray-300">•</span>
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs text-gray-400">Start chatting to create your first conversation</p>
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationClick(conversation.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 group ${
                  selectedConversationId === conversation.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {conversation.title || 'New Conversation'}
                    </h3>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {conversation.lastMessage || 'No messages yet'}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>{conversation.messageCount} messages</span>
                      <span>•</span>
                      <span>{formatTime(conversation.lastActivity)}</span>
                    </div>
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteClick(e, conversation.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all ml-2"
                    title="Delete conversation"
                  >
                    <span className="w-4 h-4">×</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          <p>Powered by ChromaDB & AI</p>
          <p className="mt-1">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  );
}
