import { ConversationContext, ConversationMessage, ConversationState, MissingInfoAnalysis, ClarificationRequest, MissingField } from '../types.js';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Manages conversation storage, persistence, and state management.
 * Handles conversation creation, message storage, and file-based persistence.
 */
export class ConversationStore {
  private conversations: Map<string, ConversationContext> = new Map();
  private conversationStates: Map<string, ConversationState> = new Map();
  private storageDir: string;

  constructor(storageDir = './conversations') {
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }

  private async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create conversations directory:', error);
    }
  }

  /**
   * Create a new conversation context
   */
  createConversation(userId?: string): ConversationContext {
    const conversationId = uuidv4();
    const context: ConversationContext = {
      id: conversationId,
      messages: [],
      metadata: {
        startTime: new Date(),
        lastActivity: new Date(),
        userPreferences: {},
        extractedInfo: {}
      }
    };

    const state: ConversationState = {
      currentTool: undefined,
      collectedParameters: {},
      missingRequiredFields: [],
      suggestedOptionalFields: [],
      conversationContext: [],
      lastActivity: new Date()
    };

    this.conversations.set(conversationId, context);
    this.conversationStates.set(conversationId, state);
    
    return context;
  }

  /**
   * Add a message to the conversation
   */
  addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: any): ConversationMessage {
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

    return message;
  }

  /**
   * Get conversation context
   */
  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Get conversation state
   */
  getConversationState(conversationId: string): ConversationState | undefined {
    return this.conversationStates.get(conversationId);
  }

  /**
   * Update conversation state
   */
  updateConversationState(conversationId: string, updates: Partial<ConversationState>): void {
    const currentState = this.conversationStates.get(conversationId);
    if (!currentState) {
      throw new Error(`Conversation state ${conversationId} not found`);
    }

    this.conversationStates.set(conversationId, { ...currentState, ...updates });
  }

  /**
   * Extract information from conversation history
   */
  extractInformationFromHistory(conversationId: string): Record<string, any> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return {};
    }

    const extractedInfo: Record<string, any> = {};
    
    // Extract information from user messages and assistant metadata
    for (const message of conversation.messages) {
      if (message.role === 'user') {
        // Simple extraction - in a real implementation, you'd use NLP
        this.extractSimpleInfo(message.content, extractedInfo);
      } else if (message.role === 'assistant' && message.metadata?.parameters) {
        Object.assign(extractedInfo, message.metadata.parameters);
      }
    }

    return extractedInfo;
  }

  private extractSimpleInfo(content: string, extracted: Record<string, any>): void {
    // Simple regex-based extraction
    const patterns = {
      email: /[\w\.-]+@[\w\.-]+\.\w+/g,
      phone: /\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
      url: /https?:\/\/[^\s]+/g,
      date: /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g,
      number: /\b\d+\b/g
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        extracted[key] = extracted[key] ? [...extracted[key], ...matches] : matches;
      }
    }
  }

  /**
   * Get conversation summary for context
   */
  getConversationSummary(conversationId: string, maxMessages = 10): string {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return '';
    }

    const recentMessages = conversation.messages.slice(-maxMessages);
    return recentMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Save conversation to disk
   */
  async saveConversation(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    const state = this.conversationStates.get(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const data = {
      conversation,
      state
    };

    const filePath = join(this.storageDir, `${conversationId}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Load conversation from disk
   */
  async loadConversation(conversationId: string): Promise<ConversationContext | null> {
    try {
      const filePath = join(this.storageDir, `${conversationId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Convert date strings back to Date objects
      parsed.conversation.metadata.startTime = new Date(parsed.conversation.metadata.startTime);
      parsed.conversation.metadata.lastActivity = new Date(parsed.conversation.metadata.lastActivity);
      parsed.conversation.messages.forEach((msg: any) => {
        msg.timestamp = new Date(msg.timestamp);
      });

      this.conversations.set(conversationId, parsed.conversation);
      if (parsed.state) {
        this.conversationStates.set(conversationId, parsed.state);
      }

      return parsed.conversation;
    } catch (error) {
      console.error(`Failed to load conversation ${conversationId}:`, error);
      return null;
    }
  }

  /**
   * List all conversations
   */
  async listConversations(): Promise<Array<{ id: string; lastActivity: Date; messageCount: number }>> {
    try {
      const files = await fs.readdir(this.storageDir);
      const conversations: Array<{ id: string; lastActivity: Date; messageCount: number }> = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const conversationId = file.replace('.json', '');
          const conversation = await this.loadConversation(conversationId);
          if (conversation) {
            conversations.push({
              id: conversationId,
              lastActivity: conversation.metadata.lastActivity,
              messageCount: conversation.messages.length
            });
          }
        }
      }

      return conversations.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    } catch (error) {
      console.error('Failed to list conversations:', error);
      return [];
    }
  }

  /**
   * Clean up old conversations
   */
  async cleanupOldConversations(daysOld = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const conversations = await this.listConversations();
    
    for (const conv of conversations) {
      if (conv.lastActivity < cutoffDate) {
        try {
          const filePath = join(this.storageDir, `${conv.id}.json`);
          await fs.unlink(filePath);
          this.conversations.delete(conv.id);
          this.conversationStates.delete(conv.id);
          console.log(`Cleaned up old conversation: ${conv.id}`);
        } catch (error) {
          console.error(`Failed to cleanup conversation ${conv.id}:`, error);
        }
      }
    }
  }
}