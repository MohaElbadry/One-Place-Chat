"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MessageSquare } from "lucide-react";

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
  onConversationDelete,
}: SidebarProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return "Just now";
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
    onConversationDelete(conversationId);
  };

  return (
    <div className="w-80 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-sidebar-foreground">
            One-Place-Chat
          </h1>
        </div>

        {/* New Conversation Button */}
        <Button onClick={onNewConversation} className="w-full">
          <Plus className="w-4 h-4" />
          New Conversation
        </Button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <span className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50">
              •
            </span>
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs text-muted-foreground/70">
              Start chatting to create your first conversation
            </p>
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationClick(conversation.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 group border ${
                  selectedConversationId === conversation.id
                    ? "bg-sidebar-accent border-sidebar-primary/30"
                    : "hover:bg-sidebar-accent/50 border-sidebar-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">
                      {conversation.title || "New Conversation"}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {conversation.lastMessage || "No messages yet"}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{conversation.messageCount} messages</span>
                      <span>•</span>
                      <span>{formatTime(conversation.lastActivity)}</span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => handleDeleteClick(e, conversation.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground text-center">
          <p>Powered by ChromaDB & AI</p>
          <p className="mt-1">
            {conversations.length} conversation
            {conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
