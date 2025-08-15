'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import ToolsPanel from './ToolsPanel';

export default function ChatInterface() {
  const [message, setMessage] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log('Sending message:', message);
      setMessage('');
    }
  };

  const handleQuickAction = (actionText: string) => {
    setMessage(actionText);
  };

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  return (
    <div className="flex h-screen bg-dark-900">
      <Sidebar onConversationSelect={handleConversationSelect} selectedConversationId={selectedConversationId} />
      <div className="flex-1 flex flex-row">
        <ChatArea 
          message={message}
          setMessage={setMessage}
          onSendMessage={handleSendMessage}
          onQuickAction={handleQuickAction}
          selectedConversationId={selectedConversationId}
        />
        <ToolsPanel />
      </div>
    </div>
  );
}
