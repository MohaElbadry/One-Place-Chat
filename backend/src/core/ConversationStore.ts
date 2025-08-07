import { ConversationContext, ConversationMessage, ConversationState } from '../types/conversation.types.js';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * ConversationStore - Manages conversation persistence and state management
 * 
 * This class handles:
 * - Creating and managing conversation contexts
 * - Storing and retrieving conversation messages
 * - Persisting conversations to disk for later retrieval
 * - Managing conversation metadata and state
 * - Extracting information from conversation history
 * - Cleaning up old conversations
 * 
 * Conversations are stored as JSON files in a configurable directory,
 * with each conversation having its own file containing messages and metadata.
 */
export class ConversationStore {
  private conversations: Map<string, ConversationContext> = new Map();
  private conversationStates: Map<string, ConversationState> = new Map();
  private storageDir: string;

  // Creates a new ConversationStore instance
  constructor(storageDir = './conversations') {
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }

  // Ensures the storage directory exists, creating it if necessary
  private async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create conversations directory:', error);
    }
  }

  // Creates a new conversation context with a unique ID
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

  // Adds a message to a specific conversation
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

  // Retrieves a conversation context by its ID
  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId);
  }

  // Retrieves the current state of a conversation
  getConversationState(conversationId: string): ConversationState | undefined {
    return this.conversationStates.get(conversationId);
  }

  // Updates the state of a conversation with new information
  updateConversationState(conversationId: string, updates: Partial<ConversationState>): void {
    const currentState = this.conversationStates.get(conversationId);
    if (!currentState) {
      throw new Error(`Conversation state ${conversationId} not found`);
    }

    this.conversationStates.set(conversationId, { ...currentState, ...updates });
  }

  // Extracts simple information from text using regex patterns
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


  // Saves a conversation to disk as a JSON file
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

  // Loads a conversation from disk
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

  // Lists all available conversations with their metadata
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

}