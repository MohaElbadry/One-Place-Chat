"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import ToolsPanel from "./ToolsPanel";
import { apiClient } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export default function ChatInterface() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [showToolModal, setShowToolModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<
    string | null
  >(null);

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
        apiClient.getTools(),
      ]);

      setConversations(conversationsResponse || []);
      setTools(toolsResponse || []);
    } catch (error) {
      console.error("Failed to load initial data:", error);
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
    setConversations((prev) => {
      const existingIndex = prev.findIndex(
        (c) => c.id === updatedConversation.id
      );

      if (existingIndex >= 0) {
        // Update existing conversation
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...updatedConversation,
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
      setConversations((prev) =>
        prev.filter((c) => c.id !== conversationToDelete)
      );

      // If the deleted conversation was selected, clear selection
      if (selectedConversationId === conversationToDelete) {
        setSelectedConversationId(null);
      }

      // Close modal
      setShowDeleteConfirm(false);
      setConversationToDelete(null);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const handleToolClick = (tool: any) => {
    setSelectedTool(tool);
    setShowToolModal(true);
  };

  const refreshTools = async () => {
    try {
      const toolsResponse = await apiClient.getTools();
      setTools(toolsResponse || []);
    } catch (error) {
      console.error("Failed to refresh tools:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted">
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
          refreshTools={refreshTools}
        />
      </div>

      {/* Tools Panel */}
      <ToolsPanel tools={tools} onToolClick={handleToolClick} />

      {/* Delete Confirmation Modal */}
      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open);
          if (!open) setConversationToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            <DialogHeader className="space-y-2">
              <DialogTitle>Delete Conversation?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. All messages and data from this
                conversation will be permanently deleted.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="w-full gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConversationToDelete(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteConversation}
                className="flex-1"
              >
                Delete
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tool Details Modal */}
      <Dialog
        open={showToolModal && selectedTool !== null}
        onOpenChange={setShowToolModal}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] bg-white">
          {selectedTool && (
            <ScrollArea className="max-h-[calc(90vh-8rem)]">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  Tool Details
                </DialogTitle>
              </DialogHeader>

              {/* Tool Header */}
              <div className="bg-gradient-to-r bg-gray-50 from-primary/10 to-accent/10 rounded-2xl p-6 mb-6 border border-primary/20">
                <div className="flex items-center gap-4">
                  <div>
                    <h4 className="text-xl font-display font-bold text-gray-600 mb-1">
                      {selectedTool.name}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`${
                          selectedTool.method === "GET"
                            ? "bg-green-500 hover:bg-green-600"
                            : selectedTool.method === "POST"
                            ? "bg-blue-500 hover:bg-blue-600"
                            : selectedTool.method === "PUT"
                            ? "bg-yellow-500 hover:bg-yellow-600"
                            : selectedTool.method === "DELETE"
                            ? "bg-red-500 hover:bg-red-600"
                            : selectedTool.method === "PATCH"
                            ? "bg-purple-500 hover:bg-purple-600"
                            : "bg-gray-500"
                        }`}
                      >
                        {selectedTool.method}
                      </Badge>
                      <span className="text-sm text-gray-600 font-code">
                        {selectedTool.path}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tool Description */}
              <div className="mb-6">
                <h5 className="text-lg font-bold text-gray-900 mb-3">
                  Description
                </h5>
                <p className="text-gray-700 leading-relaxed">
                  {selectedTool.description}
                </p>
              </div>

              {/* Parameters */}
              <div className="mb-6">
                <h5 className="text-lg font-semibold text-gray-900 mb-3">
                  Parameters
                </h5>
                <div className="space-y-3">
                  {/* Extract path parameters */}
                  {(() => {
                    const pathParams = selectedTool.path.match(/\{([^}]+)\}/g);
                    if (pathParams && pathParams.length > 0) {
                      return pathParams.map((param: string, index: number) => {
                        const paramName = param.replace(/[{}]/g, "");
                        return (
                          <div
                            key={index}
                            className="bg-gray-50 rounded-xl p-4"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-gray-900">
                                {paramName}
                              </span>
                              <Badge
                                variant="destructive"
                                className="text-xs font-medium"
                              >
                                Required
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              Path parameter from URL
                            </p>
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
                      <p className="text-sm text-gray-600">
                        No parameters required for this endpoint
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Response */}
              <div className="mb-6">
                <h5 className="text-lg font-semibold text-gray-900 mb-3">
                  Response
                </h5>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-700">
                    <div className="font-semibold text-green-600 mb-2">
                      200 - Success
                    </div>
                    <p className="mb-3">Standard HTTP success response</p>

                    {/* Show response type based on method and path */}
                    <div className="space-y-2">
                      {selectedTool.method === "GET" && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                          <span className="text-sm text-gray-600">
                            Returns data based on the endpoint
                          </span>
                        </div>
                      )}
                      {selectedTool.method === "POST" && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          <span className="text-sm text-gray-600">
                            Returns created/updated resource or confirmation
                          </span>
                        </div>
                      )}
                      {selectedTool.method === "PUT" && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                          <span className="text-sm text-gray-600">
                            Returns updated resource or confirmation
                          </span>
                        </div>
                      )}
                      {selectedTool.method === "DELETE" && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                          <span className="text-sm text-gray-600">
                            Returns deletion confirmation
                          </span>
                        </div>
                      )}
                      {selectedTool.method === "PATCH" && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                          <span className="text-sm text-gray-600">
                            Returns partially updated resource
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="mb-6">
                <h5 className="text-lg font-semibold text-gray-900 mb-3">
                  Additional Information
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tags */}
                  {selectedTool.tags && selectedTool.tags.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h6 className="font-medium text-gray-900 mb-2">Tags</h6>
                      <div className="flex flex-wrap gap-2">
                        {selectedTool.tags.map((tag: string, index: number) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h6 className="font-medium text-gray-900 mb-2">Status</h6>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          Deprecated
                        </span>
                        <Badge
                          variant={
                            selectedTool.deprecated ? "destructive" : "outline"
                          }
                          className={
                            !selectedTool.deprecated
                              ? "bg-green-50 text-green-700 border-green-200"
                              : ""
                          }
                        >
                          {selectedTool.deprecated ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Read Only</span>
                        <Badge
                          variant="outline"
                          className={
                            selectedTool.readOnly
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }
                        >
                          {selectedTool.readOnly ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          Open World
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            selectedTool.openWorld
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }
                        >
                          {selectedTool.openWorld ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-center mt-6 mb-2 gap-2 w-full ">
                <Button
                  onClick={() => setShowToolModal(false)}
                  variant="secondary"
                  className="bg-info/20 text-info hover:bg-info/30 border-info/20 font-semibold"
                >
                  Close
                </Button>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
