// API service for connecting to the Node.js backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  startTime: string;
  lastActivity?: string;
  userPreferences?: Record<string, any>;
}

export interface ConversationDetail {
  id: string;
  messages: ConversationMessage[];
  metadata: {
    startTime: string;
    lastActivity: string;
    userPreferences?: Record<string, any>;
    extractedInfo?: Record<string, any>;
  };
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    toolUsed?: string;
    parameters?: Record<string, any>;
    confidence?: number;
    needsClarification?: boolean;
    missingInfo?: string[];
  };
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  method: string;
  path: string;
  tags: string[];
  deprecated: boolean;
  title: string;
  readOnly: boolean;
  openWorld: boolean;
}

export interface ToolDetail extends Tool {
  inputSchema: any;
  endpoint: {
    method: string;
    path: string;
    baseUrl: string;
    parameters?: Array<{
      name: string;
      in: 'query' | 'path' | 'header' | 'body';
      required: boolean;
      description: string;
      type: string;
    }>;
  };
  security: Array<Record<string, string[]>>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
  limit?: number;
  offset?: number;
  timestamp?: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services?: {
    chromadb: string;
    memory: {
      used: number;
      total: number;
      external: number;
    };
    platform: string;
    nodeVersion: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Health check methods
  async healthCheck(): Promise<HealthStatus> {
    const response = await this.request<HealthStatus>('/health');
    return response.data!;
  }

  async detailedHealthCheck(): Promise<HealthStatus> {
    const response = await this.request<HealthStatus>('/health/detailed');
    return response.data!;
  }

  async readinessCheck(): Promise<HealthStatus> {
    const response = await this.request<HealthStatus>('/health/ready');
    return response.data!;
  }

  // Tool methods
  async getTools(limit?: number, offset?: number): Promise<Tool[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const response = await this.request<Tool[]>(`/tools?${params.toString()}`);
    return response.data || [];
  }

  async searchTools(query: string, limit: number = 10): Promise<Tool[]> {
    const response = await this.request<Tool[]>(`/tools/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.data || [];
  }

  async getTool(id: string): Promise<ToolDetail> {
    const response = await this.request<ToolDetail>(`/tools/${id}`);
    return response.data!;
  }

  async getToolsByCategory(category: string, limit: number = 20): Promise<Tool[]> {
    const response = await this.request<Tool[]>(`/tools/categories/${category}?limit=${limit}`);
    return response.data || [];
  }

  async getToolsStats(): Promise<{ totalTools: number; isLoaded: boolean }> {
    const response = await this.request<{ totalTools: number; isLoaded: boolean }>('/tools/stats');
    return response.data!;
  }

  // Conversation methods
  async getConversations(limit?: number, offset?: number, search?: string): Promise<Conversation[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    if (search) params.append('search', search);
    
    const response = await this.request<Conversation[]>(`/conversations?${params.toString()}`);
    return response.data || [];
  }

  async createConversation(title?: string, userId?: string): Promise<Conversation> {
    const response = await this.request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title, userId }),
    });
    return response.data!;
  }

  async getConversation(id: string): Promise<ConversationDetail> {
    const response = await this.request<ConversationDetail>(`/conversations/${id}`);
    return response.data!;
  }

  async addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: any): Promise<ConversationMessage> {
    const response = await this.request<ConversationMessage>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content, metadata }),
    });
    return response.data!;
  }

  async deleteConversation(id: string): Promise<void> {
    await this.request(`/conversations/${id}`, {
      method: 'DELETE',
    });
  }

  async getConversationStats(id: string): Promise<{
    id: string;
    messageCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    systemMessageCount: number;
    startTime: string;
    lastActivity: string;
    duration: number;
  }> {
    const response = await this.request<{
      id: string;
      messageCount: number;
      userMessageCount: number;
      assistantMessageCount: number;
      systemMessageCount: number;
      startTime: string;
      lastActivity: string;
      duration: number;
    }>(`/conversations/${id}/stats`);
    return response.data!;
  }

  async getConversationsOverviewStats(): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    oldestConversation: string | null;
    newestConversation: string | null;
  }> {
    const response = await this.request<{
      totalConversations: number;
      totalMessages: number;
      averageMessagesPerConversation: number;
      oldestConversation: string | null;
      newestConversation: string | null;
    }>('/conversations/stats/overview');
    return response.data!;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
