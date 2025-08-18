import { config } from '@/config/environment';

// API service for connecting to the Node.js backend
const API_BASE_URL = config.api.baseUrl;

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
  private retryAttempts: number;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.retryAttempts = config.api.retryAttempts;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, attempt: number = 1): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.api.timeout);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API request failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint} (attempt ${attempt}):`, error);
      
      // Retry logic for network errors
      if (attempt < this.retryAttempts && error instanceof Error && 
          (error.name === 'AbortError' || error.message.includes('fetch'))) {
        console.log(`Retrying request for ${endpoint} (attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        return this.request<T>(endpoint, options, attempt + 1);
      }
      
      throw error;
    }
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

  // Streaming chat method using Server-Sent Events (SSE)
  async streamChat(
    message: string, 
    conversationId?: string, 
    userId?: string,
    speed: 'fast' | 'normal' | 'slow' = 'normal',
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: string) => void,
    onConnection?: (conversationId: string, isNewConversation: boolean) => void,
    onToolMatch?: (toolMatch: any) => void,
    onClarification?: (clarificationRequest: any) => void,
    onExecutionResult?: (executionResult: any) => void
  ): Promise<void> {
    const url = `${this.baseUrl}/conversations/chat/stream`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, conversationId, userId, speed }),
      });

      if (!response.ok) {
        throw new Error(`Streaming request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'connection':
                  onConnection?.(data.conversationId, data.isNewConversation);
                  break;
                case 'chunk':
                  onChunk?.(data.content);
                  break;
                case 'complete':
                  onComplete?.(data.content);
                  break;
                case 'error':
                  onError?.(data.error);
                  break;
                case 'toolMatch':
                  onToolMatch?.(data.toolMatch);
                  break;
                case 'clarification':
                  onClarification?.(data.clarificationRequest);
                  break;
                case 'executionResult':
                  onExecutionResult?.(data.executionResult);
                  break;
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming chat error:', error);
      onError?.(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
