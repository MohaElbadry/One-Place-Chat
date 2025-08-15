import { v4 as uuidv4 } from 'uuid';
import { 
  ConversationContext, 
  ConversationMessage, 
  ConversationState 
} from '../types/conversation.types.js';
import { ChromaDBService } from '../database/ChromaDBService.js';

export class ConversationStoreChroma {
  private conversations: Map<string, ConversationContext> = new Map();
  private conversationStates: Map<string, ConversationState> = new Map();
  private chromaService: ChromaDBService;
  private isInitialized = false;

  constructor(chromaService: ChromaDBService) {
    this.chromaService = chromaService;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize ChromaDB service
      await this.chromaService.initialize();
      
      // Load existing conversations from ChromaDB
      await this.loadAllConversationsFromDB();
      
      this.isInitialized = true;
      console.log('✅ ChromaDB-based conversation store initialized');
    } catch (error) {
      console.error('❌ Failed to initialize ChromaDB-based conversation store:', error);
      throw error;
    }
  }

  private async loadAllConversationsFromDB(): Promise<void> {
    try {
      const conversationEmbeddings = await this.chromaService.getAllConversations();
      
              for (const ce of conversationEmbeddings) {
          const conversation: ConversationContext = {
            id: ce.conversationId,
            messages: ce.messages,
            metadata: {
              startTime: new Date(ce.metadata.startTime),
              lastActivity: new Date(ce.metadata.lastActivity),
              userPreferences: ce.metadata.userPreferences,
              extractedInfo: ce.metadata.extractedInfo
            }
          };
        
        this.conversations.set(conversation.id, conversation);
        
        // Initialize conversation state
        this.conversationStates.set(conversation.id, {
          currentTool: undefined,
          collectedParameters: {},
          missingRequiredFields: [],
          suggestedOptionalFields: [],
          conversationContext: [],
          lastActivity: new Date()
        });
      }
      
      console.log(`📚 Loaded ${conversationEmbeddings.length} conversations from ChromaDB`);
    } catch (error) {
      console.error('Error loading conversations from ChromaDB:', error);
    }
  }

  createConversation(userId?: string): ConversationContext {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    const conversationId = uuidv4();
    const now = new Date();
    
    const conversation: ConversationContext = {
      id: conversationId,
      messages: [],
      metadata: {
        startTime: now,
        lastActivity: now,
        userPreferences: userId ? { userId } : undefined,
        extractedInfo: {}
      }
    };

    // Store in memory
    this.conversations.set(conversationId, conversation);
    
    // Initialize conversation state
    this.conversationStates.set(conversationId, {
      currentTool: undefined,
      collectedParameters: {},
      missingRequiredFields: [],
      suggestedOptionalFields: [],
      conversationContext: [],
      lastActivity: now
    });

    // Store in ChromaDB
    this.chromaService.storeConversation(conversation).catch(error => {
      console.error(`Failed to store conversation ${conversationId} in ChromaDB:`, error);
    });

    return conversation;
  }

  addMessage(
    conversationId: string, 
    role: 'user' | 'assistant' | 'system', 
    content: string, 
    metadata?: any
  ): ConversationMessage {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const message: ConversationMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    conversation.messages.push(message);
    conversation.metadata.lastActivity = new Date();

    // Update conversation state
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.lastActivity = new Date();
      if (metadata?.toolUsed) {
        state.currentTool = metadata.toolUsed;
      }
      if (metadata?.parameters) {
        state.collectedParameters = { ...state.collectedParameters, ...metadata.parameters };
      }
    }

    // Update in ChromaDB
    this.chromaService.updateConversation(conversationId, conversation).catch(error => {
      console.error(`Failed to update conversation ${conversationId} in ChromaDB:`, error);
    });

    return message;
  }

  getConversation(conversationId: string): ConversationContext | undefined {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    return this.conversations.get(conversationId);
  }

  getConversationState(conversationId: string): ConversationState | undefined {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    return this.conversationStates.get(conversationId);
  }

  updateConversationState(conversationId: string, updates: Partial<ConversationState>): void {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    const state = this.conversationStates.get(conversationId);
    if (!state) {
      throw new Error(`Conversation state ${conversationId} not found`);
    }

    Object.assign(state, updates);
    state.lastActivity = new Date();

    // Update conversation in ChromaDB if we have the conversation object
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      this.chromaService.updateConversation(conversationId, conversation).catch(error => {
        console.error(`Failed to update conversation ${conversationId} in ChromaDB:`, error);
      });
    }
  }

  async saveConversation(conversationId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    try {
      await this.chromaService.updateConversation(conversationId, conversation);
    } catch (error) {
      console.error(`Failed to save conversation ${conversationId}:`, error);
      throw error;
    }
  }

  async loadConversation(conversationId: string): Promise<ConversationContext | null> {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    try {
      const conversation = await this.chromaService.getConversation(conversationId);
      
      if (conversation) {
        // Update memory cache
        this.conversations.set(conversationId, conversation);
        
        // Initialize conversation state if not exists
        if (!this.conversationStates.has(conversationId)) {
          this.conversationStates.set(conversationId, {
            currentTool: undefined,
            collectedParameters: {},
            missingRequiredFields: [],
            suggestedOptionalFields: [],
            conversationContext: [],
            lastActivity: conversation.metadata.lastActivity
          });
        }
      }
      
      return conversation;
    } catch (error) {
      console.error(`Failed to load conversation ${conversationId}:`, error);
      return null;
    }
  }

  async listConversations(): Promise<Array<{ id: string; lastActivity: Date; messageCount: number }>> {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    try {
      const conversationEmbeddings = await this.chromaService.getAllConversations();
      
      return conversationEmbeddings.map(ce => ({
        id: ce.conversationId,
        lastActivity: new Date(ce.metadata.lastActivity),
        messageCount: ce.metadata.messageCount
      })).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    } catch (error) {
      console.error('Failed to list conversations:', error);
      return [];
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    try {
      // Remove from ChromaDB
      await this.chromaService.deleteConversation(conversationId);
      
      // Remove from memory
      this.conversations.delete(conversationId);
      this.conversationStates.delete(conversationId);
      
      console.log(`🗑️ Deleted conversation ${conversationId}`);
    } catch (error) {
      console.error(`Failed to delete conversation ${conversationId}:`, error);
      throw error;
    }
  }

  async cleanupOldConversations(maxAgeHours: number = 24): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const conversations = await this.listConversations();
    const oldConversations = conversations.filter(c => c.lastActivity < cutoffTime);
    
    let deletedCount = 0;
    
    for (const conversation of oldConversations) {
      try {
        await this.deleteConversation(conversation.id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete old conversation ${conversation.id}:`, error);
      }
    }
    
    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old conversations`);
    }
    
    return deletedCount;
  }

  async searchConversations(query: string, limit: number = 5): Promise<ConversationContext[]> {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    try {
      const similarConversations = await this.chromaService.findSimilarConversations(query, limit);
      
      return similarConversations.map(ce => ({
        id: ce.conversationId,
        messages: ce.messages,
        metadata: {
          startTime: new Date(ce.metadata.startTime),
          lastActivity: new Date(ce.metadata.lastActivity),
          userPreferences: ce.metadata.userPreferences,
          extractedInfo: ce.metadata.extractedInfo
        }
      }));
    } catch (error) {
      console.error('Failed to search conversations:', error);
      return [];
    }
  }

  async getConversationStats(): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    oldestConversation: Date | null;
    newestConversation: Date | null;
  }> {
    if (!this.isInitialized) {
      throw new Error('ConversationStore not initialized');
    }

    try {
      const conversations = await this.listConversations();
      const totalConversations = conversations.length;
      
      if (totalConversations === 0) {
        return {
          totalConversations: 0,
          totalMessages: 0,
          averageMessagesPerConversation: 0,
          oldestConversation: null,
          newestConversation: null
        };
      }
      
      let totalMessages = 0;
      const dates: Date[] = [];
      
      for (const conv of conversations) {
        const conversation = this.conversations.get(conv.id);
        if (conversation) {
          totalMessages += conversation.messages.length;
          dates.push(conversation.metadata.startTime);
        }
      }
      
      const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
      
      return {
        totalConversations,
        totalMessages,
        averageMessagesPerConversation: totalMessages / totalConversations,
        oldestConversation: sortedDates[0],
        newestConversation: sortedDates[sortedDates.length - 1]
      };
    } catch (error) {
      console.error('Failed to get conversation stats:', error);
      return {
        totalConversations: 0,
        totalMessages: 0,
        averageMessagesPerConversation: 0,
        oldestConversation: null,
        newestConversation: null
      };
    }
  }

  async close(): Promise<void> {
    await this.chromaService.close();
  }
}
