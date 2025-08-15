import { ChromaClient, Collection } from 'chromadb';
import { MCPTool } from '../types/api.types.js';
import { ConversationContext, ConversationMessage } from '../types/conversation.types.js';
import { v4 as uuidv4 } from 'uuid';

export interface ToolEmbedding {
  id: string;
  tool: MCPTool;
  embedding: number[];
  metadata: {
    name: string;
    description: string;
    tags: string[];
    method: string;
    path: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ConversationEmbedding {
  id: string;
  conversationId: string;
  messages: ConversationMessage[];
  metadata: {
    startTime: string;
    lastActivity: string;
    userPreferences?: Record<string, any>;
    extractedInfo?: Record<string, any>;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
  };
}

export class ChromaDBService {
  private client: ChromaClient;
  private toolsCollection: Collection | null = null;
  private conversationsCollection: Collection | null = null;
  private isInitialized = false;

  constructor() {
    this.client = new ChromaClient({ path: 'http://localhost:8000' });
  }

  async initialize(): Promise<void> {
    try {
      // Create or get tools collection
      this.toolsCollection = await this.client.getOrCreateCollection({
        name: 'generated_tools',
        metadata: {
          description: 'API tools with embeddings for semantic search'
        }
      });

      // Create or get conversations collection
      this.conversationsCollection = await this.client.getOrCreateCollection({
        name: 'conversations',
        metadata: {
          description: 'Conversation history with context embeddings'
        }
      });

      this.isInitialized = true;
      console.log('✅ ChromaDB initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ChromaDB:', error);
      throw error;
    }
  }

  // Tool Management
  async storeToolEmbedding(tool: MCPTool, embedding: number[]): Promise<string> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const toolEmbedding: ToolEmbedding = {
      id: uuidv4(),
      tool,
      embedding,
      metadata: {
        name: tool.name,
        description: tool.description,
        tags: tool.annotations.tags || [],
        method: tool.annotations.method,
        path: tool.annotations.path,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    // Convert metadata to ChromaDB-compatible format
    const chromaMetadata = {
      name: tool.name,
      description: tool.description,
      tags: (tool.annotations.tags || []).join(','),
      method: tool.annotations.method,
      path: tool.annotations.path,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.toolsCollection!.add({
      ids: [toolEmbedding.id],
      embeddings: [embedding],
      metadatas: [chromaMetadata],
      documents: [JSON.stringify(tool)]
    });

    return toolEmbedding.id;
  }

  async findSimilarTools(query: string, embedding: number[], limit: number = 5): Promise<Array<ToolEmbedding & { similarity: number }>> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    try {
      const results = await this.toolsCollection!.query({
        queryEmbeddings: [embedding],
        nResults: limit,
        include: ['metadatas', 'documents', 'distances']
      });

      // Debug logging
      console.log('ChromaDB query results structure:', {
        hasIds: !!results.ids,
        idsLength: results.ids?.length,
        hasMetadatas: !!results.metadatas,
        hasDocuments: !!results.documents,
        hasDistances: !!results.distances
      });

      // Handle different ChromaDB result structures
      if (!results.ids || results.ids.length === 0) {
        console.log('No results found in ChromaDB query');
        return [];
      }

      // ChromaDB v3 might return results.ids as a flat array or nested array
      const resultIds = Array.isArray(results.ids[0]) ? results.ids[0] : results.ids;
      const resultMetadatas = Array.isArray(results.metadatas?.[0]) ? results.metadatas[0] : results.metadatas;
      const resultDocuments = Array.isArray(results.documents?.[0]) ? results.documents[0] : results.documents;
      const resultDistances = Array.isArray(results.distances?.[0]) ? results.distances[0] : results.distances;

      if (!resultMetadatas || !resultDocuments || !resultDistances) {
        console.log('Missing required result data:', { resultMetadatas: !!resultMetadatas, resultDocuments: !!resultDocuments, resultDistances: !!resultDistances });
        return [];
      }

      return resultIds.map((id, index) => {
        const distance = resultDistances[index] as number;
        const similarity = 1 - distance; // Convert distance to similarity score
        
        return {
          id: id as string,
          tool: JSON.parse(resultDocuments[index] as string),
          embedding: results.embeddings?.[0]?.[index] as number[] || [],
          metadata: resultMetadatas[index] as any,
          similarity
        };
      });
    } catch (error) {
      console.error('Error in findSimilarTools:', error);
      return [];
    }
  }

  async getAllTools(): Promise<ToolEmbedding[]> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const results = await this.toolsCollection!.get({
      include: ['metadatas', 'documents', 'embeddings']
    });

    if (!results.ids || !results.metadatas || !results.documents) {
      return [];
    }

    return results.ids.map((id, index) => ({
      id: id as string,
      tool: JSON.parse(results.documents![index] as string),
      embedding: results.embeddings![index] as number[],
      metadata: results.metadatas![index] as any
    }));
  }

  /**
   * Get tools from a specific collection
   */
  async getToolsFromCollection(collectionName: string): Promise<ToolEmbedding[]> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    try {
      console.log(`🔍 Getting collection: ${collectionName}`);
      const collection = await this.client.getCollection({
        name: collectionName
      });
      console.log(`✅ Collection ${collectionName} retrieved successfully`);

      console.log(`📊 Getting all items from collection ${collectionName}...`);
      const results = await collection.get({
        include: ['metadatas', 'documents', 'embeddings']
      });
      console.log(`📊 Collection results:`, {
        hasIds: !!results.ids,
        idsLength: results.ids?.length,
        hasMetadatas: !!results.metadatas,
        hasDocuments: !!results.documents,
        hasEmbeddings: !!results.embeddings
      });

      if (!results.ids || !results.metadatas || !results.documents) {
        console.log(`❌ Missing required data in collection ${collectionName}`);
        return [];
      }

      const toolEmbeddings = results.ids.map((id, index) => ({
        id: id as string,
        tool: JSON.parse(results.documents![index] as string),
        embedding: results.embeddings![index] as number[],
        metadata: results.metadatas![index] as any
      }));

      console.log(`✅ Successfully parsed ${toolEmbeddings.length} tools from collection ${collectionName}`);
      return toolEmbeddings;
    } catch (error) {
      console.error(`❌ Error getting tools from collection ${collectionName}:`, error);
      return [];
    }
  }

  async updateToolEmbedding(toolId: string, tool: MCPTool, embedding: number[]): Promise<void> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const chromaMetadata = {
      name: tool.name,
      description: tool.description,
      tags: (tool.annotations.tags || []).join(','),
      method: tool.annotations.method,
      path: tool.annotations.path,
      updatedAt: new Date().toISOString()
    };

    await this.toolsCollection!.update({
      ids: [toolId],
      embeddings: [embedding],
      metadatas: [chromaMetadata],
      documents: [JSON.stringify(tool)]
    });
  }

  async deleteTool(toolId: string): Promise<void> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    await this.toolsCollection!.delete({
      ids: [toolId]
    });
  }

  // Conversation Management
  async storeConversation(conversation: ConversationContext): Promise<string> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const conversationEmbedding: ConversationEmbedding = {
      id: uuidv4(),
      conversationId: conversation.id,
      messages: conversation.messages,
      metadata: {
        startTime: conversation.metadata.startTime.toISOString(),
        lastActivity: conversation.metadata.lastActivity.toISOString(),
        userPreferences: conversation.metadata.userPreferences,
        extractedInfo: conversation.metadata.extractedInfo,
        messageCount: conversation.messages.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    // Create a simple embedding from conversation content (you can enhance this)
    const conversationText = conversation.messages
      .map(msg => msg.content)
      .join(' ');
    
    // Simple hash-based embedding for conversations (you can use LLM embeddings here)
    const simpleEmbedding = this.generateSimpleEmbedding(conversationText);

    // Convert metadata to ChromaDB-compatible format
    const chromaMetadata = {
      startTime: conversation.metadata.startTime.toISOString(),
      lastActivity: conversation.metadata.lastActivity.toISOString(),
      messageCount: conversation.messages.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.conversationsCollection!.add({
      ids: [conversationEmbedding.id],
      embeddings: [simpleEmbedding],
      metadatas: [chromaMetadata],
      documents: [JSON.stringify(conversation)]
    });

    return conversationEmbedding.id;
  }

  async findSimilarConversations(query: string, limit: number = 5): Promise<ConversationEmbedding[]> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const simpleEmbedding = this.generateSimpleEmbedding(query);

    const results = await this.conversationsCollection!.query({
      queryEmbeddings: [simpleEmbedding],
      nResults: limit,
      include: ['metadatas', 'documents', 'distances']
    });

    if (!results.ids || !results.ids[0] || !results.metadatas || !results.documents) {
      return [];
    }

    // Type guard to ensure arrays are not null
    const metadatas = results.metadatas[0];
    const documents = results.documents[0];
    
    if (!metadatas || !documents) {
      return [];
    }

    return results.ids[0].map((id, index) => ({
      id: id as string,
      conversationId: metadatas[index].conversationId as string,
      messages: JSON.parse(documents[index] as string).messages,
      metadata: metadatas[index] as any
    }));
  }

  async getConversation(conversationId: string): Promise<ConversationContext | null> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const results = await this.conversationsCollection!.get({
      where: { conversationId },
      include: ['documents']
    });

    if (!results.ids || results.ids.length === 0 || !results.documents) {
      return null;
    }

    return JSON.parse(results.documents[0] as string);
  }

  async updateConversation(conversationId: string, conversation: ConversationContext): Promise<void> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    // Find the existing conversation record
    const existing = await this.conversationsCollection!.get({
      where: { conversationId },
      include: ['metadatas', 'documents']
    });

    if (!existing.ids || existing.ids.length === 0) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const recordId = existing.ids[0] as string;
    const conversationText = conversation.messages
      .map(msg => msg.content)
      .join(' ');
    
    const simpleEmbedding = this.generateSimpleEmbedding(conversationText);

    const chromaMetadata = {
      startTime: conversation.metadata.startTime.toISOString(),
      lastActivity: conversation.metadata.lastActivity.toISOString(),
      messageCount: conversation.messages.length,
      updatedAt: new Date().toISOString()
    };

    await this.conversationsCollection!.update({
      ids: [recordId],
      embeddings: [simpleEmbedding],
      metadatas: [chromaMetadata],
      documents: [JSON.stringify(conversation)]
    });
  }

  async deleteConversation(conversationId: string): Promise<void> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const existing = await this.conversationsCollection!.get({
      where: { conversationId },
      include: ['metadatas', 'documents']
    });

    if (existing.ids && existing.ids.length > 0) {
      await this.conversationsCollection!.delete({
        ids: existing.ids as string[]
      });
    }
  }

  async getAllConversations(): Promise<ConversationEmbedding[]> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const results = await this.conversationsCollection!.get({
      include: ['metadatas', 'documents', 'embeddings']
    });

    if (!results.ids || !results.metadatas || !results.documents) {
      return [];
    }

    // Type guard to ensure arrays are not null
    const metadatas = results.metadatas;
    const documents = results.documents;
    
    if (!metadatas || !documents) {
      return [];
    }

    return results.ids.map((id, index) => ({
      id: id as string,
      conversationId: metadatas[index].conversationId as string,
      messages: JSON.parse(documents[index] as string).messages,
      metadata: metadatas[index] as any
    }));
  }

  // Utility Methods
  private generateSimpleEmbedding(text: string): number[] {
    // Simple hash-based embedding for basic similarity
    // In production, you might want to use actual LLM embeddings here
    const hash = this.simpleHash(text);
    const embedding = new Array(1536).fill(0); // OpenAI embedding size
    
    // Distribute hash across embedding dimensions
    for (let i = 0; i < Math.min(hash.length, embedding.length); i++) {
      embedding[i] = (hash.charCodeAt(i) - 128) / 128; // Normalize to [-1, 1]
    }
    
    return embedding;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Database Management
  async clearAllData(): Promise<void> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    await this.client.deleteCollection({ name: 'tools' });
    await this.client.deleteCollection({ name: 'conversations' });
    
    // Recreate collections
    await this.initialize();
  }

  async getDatabaseStats(): Promise<{
    toolsCount: number;
    conversationsCount: number;
    totalEmbeddings: number;
  }> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const toolsCount = await this.toolsCollection!.count();
    const conversationsCount = await this.conversationsCollection!.count();

    return {
      toolsCount,
      conversationsCount,
      totalEmbeddings: toolsCount + conversationsCount
    };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.heartbeat();
    }
  }
}
