import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatInterface } from '../ChatInterface';

// Mock the API module
jest.mock('../../lib/api', () => ({
  sendMessage: jest.fn(),
  getTools: jest.fn(),
  getConversations: jest.fn(),
}));

// Mock the ChatArea component
jest.mock('../ChatArea', () => ({
  ChatArea: ({ onSendMessage, messages, isLoading }: any) => (
    <div data-testid="chat-area">
      <div data-testid="messages">
        {messages.map((msg: any, index: number) => (
          <div key={index} data-testid={`message-${index}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <button
        data-testid="send-button"
        onClick={() => onSendMessage('Test message')}
        disabled={isLoading}
      >
        Send
      </button>
    </div>
  ),
}));

// Mock the Sidebar component
jest.mock('../Sidebar', () => ({
  Sidebar: ({ onNewConversation, conversations }: any) => (
    <div data-testid="sidebar">
      <button data-testid="new-conversation" onClick={onNewConversation}>
        New Conversation
      </button>
      <div data-testid="conversations">
        {conversations.map((conv: any, index: number) => (
          <div key={index} data-testid={`conversation-${index}`}>
            {conv.title}
          </div>
        ))}
      </div>
    </div>
  ),
}));

// Mock the ToolsPanel component
jest.mock('../ToolsPanel', () => ({
  ToolsPanel: ({ tools, onToolSelect }: any) => (
    <div data-testid="tools-panel">
      {tools.map((tool: any, index: number) => (
        <button
          key={index}
          data-testid={`tool-${index}`}
          onClick={() => onToolSelect(tool)}
        >
          {tool.name}
        </button>
      ))}
    </div>
  ),
}));

describe('ChatInterface', () => {
  const mockApi = require('../../lib/api');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockApi.sendMessage.mockResolvedValue({
      success: true,
      data: {
        message: 'Test response',
        conversationId: 'test-conversation-id',
      },
    });
    
    mockApi.getTools.mockResolvedValue({
      success: true,
      data: [
        { id: 'tool1', name: 'Test Tool 1', description: 'Test tool 1' },
        { id: 'tool2', name: 'Test Tool 2', description: 'Test tool 2' },
      ],
    });
    
    mockApi.getConversations.mockResolvedValue({
      success: true,
      data: [
        { id: 'conv1', title: 'Test Conversation 1', lastActivity: new Date() },
        { id: 'conv2', title: 'Test Conversation 2', lastActivity: new Date() },
      ],
    });
  });

  it('renders all main components', async () => {
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('chat-area')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('tools-panel')).toBeInTheDocument();
    });
  });

  it('loads tools on mount', async () => {
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(mockApi.getTools).toHaveBeenCalled();
    });
  });

  it('loads conversations on mount', async () => {
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(mockApi.getConversations).toHaveBeenCalled();
    });
  });

  it('displays loaded tools', async () => {
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('tool-0')).toHaveTextContent('Test Tool 1');
      expect(screen.getByTestId('tool-1')).toHaveTextContent('Test Tool 2');
    });
  });

  it('displays loaded conversations', async () => {
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('conversation-0')).toHaveTextContent('Test Conversation 1');
      expect(screen.getByTestId('conversation-1')).toHaveTextContent('Test Conversation 2');
    });
  });

  it('handles sending messages', async () => {
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('send-button')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('send-button'));
    
    await waitFor(() => {
      expect(mockApi.sendMessage).toHaveBeenCalledWith('Test message');
    });
  });

  it('handles new conversation creation', async () => {
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('new-conversation')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('new-conversation'));
    
    // Should create a new conversation
    await waitFor(() => {
      expect(screen.getByTestId('chat-area')).toBeInTheDocument();
    });
  });

  it('handles tool selection', async () => {
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('tool-0')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('tool-0'));
    
    // Should handle tool selection
    await waitFor(() => {
      expect(screen.getByTestId('chat-area')).toBeInTheDocument();
    });
  });

  it('displays loading state', async () => {
    mockApi.sendMessage.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('send-button')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('send-button'));
    
    // Should show loading state
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('handles API errors gracefully', async () => {
    mockApi.sendMessage.mockRejectedValue(new Error('API Error'));
    
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('send-button')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('send-button'));
    
    // Should handle error without crashing
    await waitFor(() => {
      expect(screen.getByTestId('chat-area')).toBeInTheDocument();
    });
  });

  it('handles tools loading error', async () => {
    mockApi.getTools.mockRejectedValue(new Error('Tools loading failed'));
    
    render(<ChatInterface />);
    
    // Should handle error without crashing
    await waitFor(() => {
      expect(screen.getByTestId('chat-area')).toBeInTheDocument();
    });
  });

  it('handles conversations loading error', async () => {
    mockApi.getConversations.mockRejectedValue(new Error('Conversations loading failed'));
    
    render(<ChatInterface />);
    
    // Should handle error without crashing
    await waitFor(() => {
      expect(screen.getByTestId('chat-area')).toBeInTheDocument();
    });
  });

  it('updates messages after sending', async () => {
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('send-button')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('send-button'));
    
    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('Test message');
      expect(screen.getByTestId('message-1')).toHaveTextContent('Test response');
    });
  });

  it('handles empty tools list', async () => {
    mockApi.getTools.mockResolvedValue({
      success: true,
      data: [],
    });
    
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('tools-panel')).toBeInTheDocument();
    });
    
    // Should not crash with empty tools
    expect(screen.queryByTestId('tool-0')).not.toBeInTheDocument();
  });

  it('handles empty conversations list', async () => {
    mockApi.getConversations.mockResolvedValue({
      success: true,
      data: [],
    });
    
    render(<ChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
    
    // Should not crash with empty conversations
    expect(screen.queryByTestId('conversation-0')).not.toBeInTheDocument();
  });
});
