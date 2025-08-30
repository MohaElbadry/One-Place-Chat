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
    userPreferences?: string; // JSON stringified
    extractedInfo?: string; // JSON stringified
    messageCount: number;
    title: string;
    lastMessage: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface MessageEmbedding {
  id: string;
  conversationId: string;
  message: ConversationMessage;
  embedding: number[];
  metadata: {
    role: string;
    content: string;
    timestamp: string;
    conversationId: string;
    createdAt: string;
  };
}

export class ChromaDBService {
  private client: ChromaClient;
  private toolsCollection: Collection | null = null;
  private conversationsCollection: Collection | null = null;
  private messagesCollection: Collection | null = null;
  private isInitialized = false;

  constructor() {
    const host = process.env.CHROMADB_HOST || 'localhost';
    const port = parseInt(process.env.CHROMADB_PORT || '8000');
    
    this.client = new ChromaClient({ 
      host,
      port
    });
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

      // Create or get messages collection
      this.messagesCollection = await this.client.getOrCreateCollection({
        name: 'messages',
        metadata: {
          description: 'Individual conversation messages with embeddings for semantic search'
        }
      });

      this.isInitialized = true;
      // Removed verbose initialization logging
    } catch (error) {
      console.error('❌ Failed to initialize ChromaDB:', error);
      throw error;
    }
  }

  // Tool Management
  async storeToolEmbedding(tool: MCPTool, embedding: number[]): Promise<string> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    // Check if tool already exists based on name, method, and path
    const existingTools = await this.toolsCollection!.get({
      where: {
        name: tool.name,
        method: tool.annotations.method,
        path: tool.annotations.path
      },
      include: ['metadatas']
    });

    if (existingTools.ids && existingTools.ids.length > 0) {
      // Tool already exists, return existing ID
      console.log(`Tool ${tool.name} already exists, skipping duplicate insertion`);
      return existingTools.ids[0] as string;
    }

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
      const collection = await this.client.getCollection({
        name: collectionName
      });

      const results = await collection.get({
        include: ['metadatas', 'documents', 'embeddings']
      });

      if (!results.ids || !results.metadatas || !results.documents) {
        return [];
      }

      const toolEmbeddings = results.ids.map((id, index) => ({
        id: id as string,
        tool: JSON.parse(results.documents![index] as string),
        embedding: results.embeddings![index] as number[],
        metadata: results.metadatas![index] as any
      }));

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

    // Check if conversation already exists based on conversationId
    const existingConversations = await this.conversationsCollection!.get({
      where: {
        conversationId: conversation.id
      },
      include: ['metadatas']
    });

    if (existingConversations.ids && existingConversations.ids.length > 0) {
      // Conversation already exists, update it instead of creating duplicate
      console.log(`Conversation ${conversation.id} already exists, updating instead of creating duplicate`);
      await this.updateConversation(conversation.id, conversation);
      return existingConversations.ids[0] as string;
    }

    const conversationEmbedding: ConversationEmbedding = {
      id: uuidv4(),
      conversationId: conversation.id,
      messages: conversation.messages,
      metadata: {
        startTime: conversation.metadata.startTime.toISOString(),
        lastActivity: conversation.metadata.lastActivity.toISOString(),
        userPreferences: conversation.metadata.userPreferences ? JSON.stringify(conversation.metadata.userPreferences) : undefined,
        extractedInfo: conversation.metadata.extractedInfo ? JSON.stringify(conversation.metadata.extractedInfo) : undefined,
        messageCount: conversation.messages.length,
        title: conversation.messages.length > 0 ? conversation.messages[0].content.substring(0, 50) : 'New Conversation',
        lastMessage: conversation.messages.length > 0 ? conversation.messages[conversation.messages.length - 1].content.substring(0, 100) : '',
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
      conversationId: conversation.id,
      startTime: conversation.metadata.startTime instanceof Date 
        ? conversation.metadata.startTime.toISOString() 
        : conversation.metadata.startTime,
      lastActivity: conversation.metadata.lastActivity instanceof Date 
        ? conversation.metadata.lastActivity.toISOString() 
        : conversation.metadata.lastActivity,
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

    // Store individual messages for better scalability and search
    await this.storeMessages(conversation.id, conversation.messages);

    return conversationEmbedding.id;
  }

  // Store individual messages for better scalability and search
  async storeMessages(conversationId: string, messages: ConversationMessage[]): Promise<void> {
    if (!this.isInitialized || !this.messagesCollection) return;

    try {
      // Clear existing messages for this conversation to prevent duplicates
      await this.messagesCollection.delete({
        where: { conversationId }
      });

      if (messages.length === 0) return;

      const messageIds: string[] = [];
      const messageEmbeddings: number[][] = [];
      const messageMetadatas: any[] = [];
      const messageDocuments: string[] = [];

      for (const message of messages) {
        const messageId = uuidv4();
        const messageText = message.content;
        const simpleEmbedding = this.generateSimpleEmbedding(messageText);

        messageIds.push(messageId);
        messageEmbeddings.push(simpleEmbedding);
        messageMetadatas.push({
          role: message.role,
          content: message.content.substring(0, 100), // Store truncated content in metadata
          timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : String(message.timestamp),
          conversationId: conversationId,
          createdAt: new Date().toISOString()
        });
        messageDocuments.push(JSON.stringify(message));
      }

      await this.messagesCollection.add({
        ids: messageIds,
        embeddings: messageEmbeddings,
        metadatas: messageMetadatas,
        documents: messageDocuments
      });

      console.log(`✅ Stored ${messages.length} messages for conversation ${conversationId}`);
    } catch (error) {
      console.error(`❌ Error storing messages for conversation ${conversationId}:`, error);
    }
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

    // Use the title from metadata if available, otherwise use the first user message
    const firstUserMessage = conversation.messages.find(msg => msg.role === 'user');
    const title = conversation.metadata.title || (firstUserMessage ? firstUserMessage.content.substring(0, 50) : 'New Conversation');
    
    // Get the last message content
    const lastMessage = conversation.messages.length > 0 
      ? conversation.messages[conversation.messages.length - 1].content.substring(0, 100)
      : '';

    const chromaMetadata = {
      conversationId: conversation.id,
      title: title,
      lastMessage: lastMessage,
      startTime: conversation.metadata.startTime instanceof Date 
        ? conversation.metadata.startTime.toISOString() 
        : conversation.metadata.startTime,
      lastActivity: conversation.metadata.lastActivity instanceof Date 
        ? conversation.metadata.lastActivity.toISOString() 
        : conversation.metadata.lastActivity,
      messageCount: conversation.messages.length,
      userPreferences: conversation.metadata.userPreferences ? JSON.stringify(conversation.metadata.userPreferences) : undefined,
      extractedInfo: conversation.metadata.extractedInfo ? JSON.stringify(conversation.metadata.extractedInfo) : undefined,
      updatedAt: new Date().toISOString()
    };

    await this.conversationsCollection!.update({
      ids: [recordId],
      embeddings: [simpleEmbedding],
      metadatas: [chromaMetadata],
      documents: [JSON.stringify(conversation)]
    });

    // Also update the individual messages
    await this.storeMessages(conversationId, conversation.messages);
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

  // Clean up duplicate conversations, keeping only the most recent one for each conversationId
  async cleanupDuplicateConversations(): Promise<number> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    try {
      const results = await this.conversationsCollection!.get({
        include: ['metadatas']
      });

      if (!results.ids || !results.metadatas) {
        return 0;
      }

      // Group by conversationId to find duplicates
      const conversationGroups = new Map<string, Array<{ id: string; lastActivity: string; createdAt: string }>>();
      
      results.ids.forEach((id, index) => {
        const metadata = results.metadatas[index];
        if (metadata) {
          const conversationId = metadata.conversationId as string;
          if (!conversationGroups.has(conversationId)) {
            conversationGroups.set(conversationId, []);
          }
          conversationGroups.get(conversationId)!.push({
            id: id as string,
            lastActivity: metadata.lastActivity as string || metadata.createdAt as string,
            createdAt: metadata.createdAt as string
          });
        }
      });

      // Find duplicates and mark for deletion
      const idsToDelete: string[] = [];
      
      for (const [conversationId, records] of conversationGroups) {
        if (records.length > 1) {
          // Sort by lastActivity, keep the most recent
          records.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
          
          // Mark older duplicates for deletion
          for (let i = 1; i < records.length; i++) {
            idsToDelete.push(records[i].id);
          }
        }
      }

      if (idsToDelete.length > 0) {
        await this.conversationsCollection!.delete({
          ids: idsToDelete
        });
        console.log(`🧹 Cleaned up ${idsToDelete.length} duplicate conversations`);
        return idsToDelete.length;
      }

      return 0;
    } catch (error) {
      console.error('❌ Error cleaning up duplicate conversations:', error);
      return 0;
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

    // Deduplicate conversations by conversationId, keeping the most recent one
    const conversationMap = new Map<string, ConversationEmbedding>();
    
    results.ids.forEach((id, index) => {
      const metadata = metadatas[index];
      if (!metadata || !metadata.conversationId) return; // Skip invalid entries
      
      const conversationId = metadata.conversationId as string;
      const existing = conversationMap.get(conversationId);
      
      const currentLastActivity = metadata.lastActivity || metadata.createdAt;
      
      if (!existing) {
        // First time seeing this conversationId, add it
        conversationMap.set(conversationId, {
          id: id as string,
          conversationId: conversationId,
          messages: JSON.parse(documents[index] as string).messages,
          metadata: metadata as any
        });
      } else {
        // Check if current entry is more recent
        const existingLastActivity = existing.metadata.lastActivity || existing.metadata.createdAt;
        if (new Date(currentLastActivity as string) > new Date(existingLastActivity as string)) {
          conversationMap.set(conversationId, {
            id: id as string,
            conversationId: conversationId,
            messages: JSON.parse(documents[index] as string).messages,
            metadata: metadata as any
          });
        }
      }
    });

    return Array.from(conversationMap.values());
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

  /**
   * Ensure all required collections exist, creating them if they don't
   */
  async ensureCollectionsExist(): Promise<void> {
    try {
      if (!this.toolsCollection) {
        this.toolsCollection = await this.client.getOrCreateCollection({
          name: 'generated_tools',
          metadata: { description: 'API tools with embeddings for semantic search' }
        });
      }
      
      if (!this.conversationsCollection) {
        this.conversationsCollection = await this.client.getOrCreateCollection({
          name: 'conversations',
          metadata: { description: 'Conversation history with context embeddings' }
        });
      }
      
      if (!this.messagesCollection) {
        this.messagesCollection = await this.client.getOrCreateCollection({
          name: 'messages',
          metadata: { description: 'Individual conversation messages with embeddings for semantic search' }
        });
      }
      
      console.log('✅ All required collections verified/created');
    } catch (error) {
      console.error('❌ Failed to ensure collections exist:', error);
      throw error;
    }
  }

  /**
   * Safe method to get collection with fallback creation
   */
  private async getOrCreateCollectionSafe(name: string, metadata: any): Promise<Collection> {
    try {
      return await this.client.getCollection({ name });
    } catch (error) {
      console.log(`📝 Collection '${name}' not found, creating it...`);
      return await this.client.createCollection({
        name,
        metadata
      });
    }
  }

  async getDatabaseStats(): Promise<{
    toolsCount: number;
    conversationsCount: number;
    totalEmbeddings: number;
  }> {
    if (!this.isInitialized) {
      // Try to initialize if not already done
      await this.ensureCollectionsExist();
    }

    try {
      const toolsCount = await this.toolsCollection!.count();
      const conversationsCount = await this.conversationsCollection!.count();

      return {
        toolsCount,
        conversationsCount,
        totalEmbeddings: toolsCount + conversationsCount
      };
    } catch (error) {
      console.error('❌ Error getting database stats:', error);
      return {
        toolsCount: 0,
        conversationsCount: 0,
        totalEmbeddings: 0
      };
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.heartbeat();
    }
  }
}
