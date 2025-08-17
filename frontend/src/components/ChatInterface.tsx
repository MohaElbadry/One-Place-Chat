'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import ToolsPanel from './ToolsPanel';
import { apiClient } from '@/lib/api';

export default function ChatInterface() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load conversations and tools on component mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load conversations and tools in parallel
      const [conversationsResponse, toolsResponse] = await Promise.all([
        apiClient.getConversations(),
        apiClient.getTools()
      ]);

      setConversations(conversationsResponse || []);
      setTools(toolsResponse || []);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleNewConversation = () => {
    setSelectedConversationId(null);
  };

  const handleConversationUpdate = (updatedConversation: any) => {
    // Update the conversation in the list
    setConversations(prev => {
      const existingIndex = prev.findIndex(c => c.id === updatedConversation.id);
      
      if (existingIndex >= 0) {
        // Update existing conversation
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...updatedConversation
        };
        return updated;
      } else {
        // Add new conversation to the beginning
        return [updatedConversation, ...prev];
      }
    });
  };

  const handleConversationDelete = async (conversationId: string) => {
    try {
      await apiClient.deleteConversation(conversationId);
      
      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      // If the deleted conversation was selected, clear selection
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
        onConversationDelete={handleConversationDelete}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatArea
          selectedConversationId={selectedConversationId}
          onConversationUpdate={handleConversationUpdate}
        />
      </div>

      {/* Tools Panel */}
      <ToolsPanel tools={tools} />
    </div>
  );
}
