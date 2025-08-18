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
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [showToolModal, setShowToolModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

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
    // Show delete confirmation modal
    setConversationToDelete(conversationId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return;
    
    try {
      await apiClient.deleteConversation(conversationToDelete);
      
      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== conversationToDelete));
      
      // If the deleted conversation was selected, clear selection
      if (selectedConversationId === conversationToDelete) {
        setSelectedConversationId(null);
      }
      
      // Close modal
      setShowDeleteConfirm(false);
      setConversationToDelete(null);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleToolClick = (tool: any) => {
    setSelectedTool(tool);
    setShowToolModal(true);
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
      <ToolsPanel 
        tools={tools} 
        onToolClick={handleToolClick}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => {
            setShowDeleteConfirm(false);
            setConversationToDelete(null);
          }}
        >
          <div 
            className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* Icon */}
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-display text-gray-900 mb-3">Delete Conversation?</h3>
              
              {/* Description */}
              <p className="text-gray-600 mb-8 leading-relaxed">
                This action cannot be undone. All messages and data from this conversation will be permanently deleted.
              </p>
              
              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setConversationToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl font-medium transition-smooth"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteConversation}
                  className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-semibold transition-smooth shadow-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tool Details Modal */}
      {showToolModal && selectedTool && (
        <div 
          className=" overflow-auto fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowToolModal(false)}
        >
          <div 
            className="hide-scrollbar  overflow-auto bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-display text-gray-900">Tool Details</h3>
              <button
                onClick={() => setShowToolModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-smooth"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Tool Header */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-6 mb-6 border border-primary/20">
              <div className="flex items-center gap-4">
                
                <div>
                  <h4 className="text-xl font-display text-primary mb-1">{selectedTool.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                      selectedTool.method === 'GET' ? 'http-get' :
                      selectedTool.method === 'POST' ? 'http-post' :
                      selectedTool.method === 'PUT' ? 'http-put' :
                      selectedTool.method === 'DELETE' ? 'http-delete' :
                      selectedTool.method === 'PATCH' ? 'http-patch' : 'bg-gray-500'
                    }`}>
                      {selectedTool.method}
                    </span>
                    <span className="text-sm text-gray-600 font-code">{selectedTool.path}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Tool Description */}
            <div className="mb-6">
              <h5 className="text-lg font-bold text-gray-900 mb-3">Description</h5>
              <p className="text-gray-700 leading-relaxed">{selectedTool.description}</p>
            </div>
            
            {/* Parameters */}
            <div className="mb-6">
              <h5 className="text-lg font-semibold text-gray-900 mb-3">Parameters</h5>
              <div className="space-y-3">
                {/* Extract path parameters */}
                {(() => {
                  const pathParams = selectedTool.path.match(/\{([^}]+)\}/g);
                  if (pathParams && pathParams.length > 0) {
                    return pathParams.map((param: string, index: number) => {
                      const paramName = param.replace(/[{}]/g, '');
                      return (
                        <div key={index} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-900">{paramName}</span>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                              Required
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">Path parameter from URL</p>
                          <div className="text-xs text-gray-500 font-code">
                            Type: string (URL segment)
                          </div>
                        </div>
                      );
                    });
                  }
                  return null;
                })()}
                
                {/* Show message if no parameters */}
                {!selectedTool.path.match(/\{([^}]+)\}/g) && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-600">No parameters required for this endpoint</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Response */}
            <div className="mb-6">
              <h5 className="text-lg font-semibold text-gray-900 mb-3">Response</h5>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-700">
                  <div className="font-semibold text-green-600 mb-2">200 - Success</div>
                  <p className="mb-3">Standard HTTP success response</p>
                  
                  {/* Show response type based on method and path */}
                  <div className="space-y-2">
                    {selectedTool.method === 'GET' && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        <span className="text-sm text-gray-600">Returns data based on the endpoint</span>
                      </div>
                    )}
                    {selectedTool.method === 'POST' && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        <span className="text-sm text-gray-600">Returns created/updated resource or confirmation</span>
                      </div>
                    )}
                    {selectedTool.method === 'PUT' && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                        <span className="text-sm text-gray-600">Returns updated resource or confirmation</span>
                      </div>
                    )}
                    {selectedTool.method === 'DELETE' && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                        <span className="text-sm text-gray-600">Returns deletion confirmation</span>
                      </div>
                    )}
                    {selectedTool.method === 'PATCH' && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                        <span className="text-sm text-gray-600">Returns partially updated resource</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Additional Information */}
            <div className="mb-6">
              <h5 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tags */}
                {selectedTool.tags && selectedTool.tags.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h6 className="font-medium text-gray-900 mb-2">Tags</h6>
                    <div className="flex flex-wrap gap-2">
                      {selectedTool.tags.map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Status */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h6 className="font-medium text-gray-900 mb-2">Status</h6>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Deprecated</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedTool.deprecated ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {selectedTool.deprecated ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Read Only</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedTool.readOnly ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedTool.readOnly ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Open World</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedTool.openWorld ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedTool.openWorld ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Close Button */}
            <div className="text-center">
              <button
                onClick={() => setShowToolModal(false)}
                className="px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl font-semibold transition-smooth shadow-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
