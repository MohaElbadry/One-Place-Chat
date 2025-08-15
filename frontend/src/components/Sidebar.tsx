'use client';

import { useState } from 'react';

interface SidebarProps {
  onConversationSelect: (conversationId: string) => void;
  selectedConversationId?: string;
}

export default function Sidebar({ onConversationSelect, selectedConversationId }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mock data - will be replaced with real API calls
  const conversations = [
    { id: '1', title: 'Chat', lastMessage: 'Now', isActive: true },
    { id: '2', title: 'Petstore API Chat', lastMessage: '2h ago', isActive: false },
  ];

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 bg-dark-800 border-r border-dark-600 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-600">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            One-Place-Chat
          </h1>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
              </svg>
            </button>
            <button className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input 
            type="text" 
            placeholder="Search conversations..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Conversations Section */}
      <div className="flex-1 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-300">Conversations</h2>
            <button className="p-1 hover:bg-dark-700 rounded transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
            </button>
          </div>
          
          {/* New Conversation Button */}
          <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg p-3 mb-3 transition-all duration-200 flex items-center gap-2 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
            New conversation
          </button>
        </div>

        {/* Chat List */}
        <div className="chat-scroll overflow-y-auto flex-1 px-2">
          <div className="space-y-1">
            {filteredConversations.map((conversation) => (
              <div 
                key={conversation.id}
                onClick={() => onConversationSelect(conversation.id)}
                className={`${
                  conversation.isActive 
                    ? 'bg-dark-700 border-l-2 border-blue-500' 
                    : 'hover:bg-dark-700'
                } rounded-r-lg p-3 cursor-pointer transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    conversation.isActive ? 'text-blue-400' : 'text-gray-300'
                  }`}>
                    {conversation.title}
                  </span>
                  <span className="text-xs text-gray-500">{conversation.lastMessage}</span>
                </div>
                {!conversation.isActive && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    Last message {conversation.lastMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Start a new chat section */}
      <div className="p-4 border-t border-dark-600">
        <p className="text-xs text-gray-400 mb-2">Start a new chat</p>
      </div>
    </div>
  );
}
