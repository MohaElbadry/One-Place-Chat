import { Router } from 'express';
import { ConversationStoreChroma } from '../../core/ConversationStoreChroma.js';
import { ChromaDBService } from '../../database/ChromaDBService.js';
import { ConversationalEngine } from '../../core/ConversationalEngine.js';
import { ChromaDBToolLoader } from '../../tools/ChromaDBToolLoader.js';
import { ErrorHandler } from '../../utils/ErrorHandler.js';

const router = Router();
const chromaService = new ChromaDBService();
const conversationStore = new ConversationStoreChroma(chromaService);
let chatEngine: ConversationalEngine | null = null;
let tools: any[] = [];

// Initialize services
let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    try {
      await chromaService.initialize();
      await conversationStore.initialize();
      
      // Initialize chat engine with tools
      const toolLoader = new ChromaDBToolLoader();
      tools = await toolLoader.loadTools();
      
      chatEngine = new ConversationalEngine('gpt-4-turbo-preview');
      chatEngine.updateTools(tools);
      await chatEngine.initializeToolMatcher();
      
      // Use the same conversation store instance
      chatEngine['conversationStore'] = conversationStore;
      
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw new Error('Services not available');
    }
  }
}

// GET /api/conversations - Get all conversations
router.get('/', ErrorHandler.asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, search } = req.query;
  
  await ensureInitialized();
  
  let conversations;
  if (search && typeof search === 'string') {
    conversations = await conversationStore.searchConversations(search, parseInt(limit as string) || 50);
  } else {
    const allConversations = await conversationStore.listConversations();
    const searchLimit = Math.min(parseInt(limit as string) || 50, 100);
    const searchOffset = parseInt(offset as string) || 0;
    conversations = allConversations.slice(searchOffset, searchOffset + searchLimit);
  }
  
  res.json({
    success: true,
    data: conversations.map(conv => ({
      id: conv.id,
      title: conv.title || 'New Conversation',
      lastMessage: conv.lastMessage || '',
      messageCount: conv.messageCount || 0,
      startTime: conv.startTime || new Date().toISOString(),
      lastActivity: conv.lastActivity || new Date().toISOString(),
      userPreferences: conv.userPreferences
    })),
    count: conversations.length,
    limit: parseInt(limit as string) || 50,
    offset: parseInt(offset as string) || 0,
    timestamp: new Date().toISOString()
  });
}, 'fetching conversations'));

// POST /api/conversations - Create a new conversation
router.post('/', ErrorHandler.asyncHandler(async (req, res) => {
  const { title, userId } = req.body;
  
  await ensureInitialized();
  
  const conversation = conversationStore.createConversation(userId);
  
  // Add initial message if title is provided
  if (title && typeof title === 'string') {
    conversationStore.addMessage(conversation.id, 'user', title);
  }
  
  await conversationStore.saveConversation(conversation.id);
  
  res.status(201).json({
    success: true,
    data: {
      id: conversation.id,
      title: title || 'New Conversation',
      messageCount: conversation.messages ? conversation.messages.length : 0,
      startTime: conversation.metadata?.startTime || new Date().toISOString(),
      lastActivity: conversation.metadata?.lastActivity || new Date().toISOString()
    },
    message: 'Conversation created successfully',
    timestamp: new Date().toISOString()
  });
}, 'creating conversation'));

// GET /api/conversations/:id - Get specific conversation
router.get('/:id', ErrorHandler.asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await ensureInitialized();
  
  const conversation = await conversationStore.loadConversation(id);
  
  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found',
      message: `Conversation with ID "${id}" not found`
    });
  }
  
  res.json({
    success: true,
    data: {
      id: conversation.id,
      messages: conversation.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        metadata: msg.metadata
      })),
      metadata: conversation.metadata,
      messageCount: conversation.messages.length
    },
    timestamp: new Date().toISOString()
  });
}, 'fetching conversation'));

// POST /api/conversations/:id/messages - Add message to conversation
router.post('/:id/messages', ErrorHandler.asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, content, metadata } = req.body;
  
  if (!role || !content) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'Role and content are required'
    });
  }
  
  if (!['user', 'assistant', 'system'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid role',
      message: 'Role must be user, assistant, or system'
    });
  }
  
  await ensureInitialized();
  
  // Check if conversation exists
  const conversation = await conversationStore.loadConversation(id);
  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found',
      message: `Conversation with ID "${id}" not found`
    });
  }
  
  const message = conversationStore.addMessage(id, role, content, metadata);
  await conversationStore.saveConversation(id);
  
  res.status(201).json({
    success: true,
    data: {
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      metadata: message.metadata
    },
    message: 'Message added successfully',
    timestamp: new Date().toISOString()
  });
}, 'adding message'));

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', ErrorHandler.asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await ensureInitialized();
  
  // Check if conversation exists
  const conversation = await conversationStore.loadConversation(id);
  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found',
      message: `Conversation with ID "${id}" not found`
    });
  }
  
  await conversationStore.deleteConversation(id);
  
  res.json({
    success: true,
    message: 'Conversation deleted successfully',
    timestamp: new Date().toISOString()
  });
}, 'deleting conversation'));

// GET /api/conversations/:id/stats - Get conversation statistics
router.get('/:id/stats', ErrorHandler.asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await ensureInitialized();
  
  const conversation = await conversationStore.loadConversation(id);
  
  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found',
      message: `Conversation with ID "${id}" not found`
    });
  }
  
  const stats = {
    id: conversation.id,
    messageCount: conversation.messages.length,
    userMessageCount: conversation.messages.filter(m => m.role === 'user').length,
    assistantMessageCount: conversation.messages.filter(m => m.role === 'assistant').length,
    systemMessageCount: conversation.messages.filter(m => m.role === 'system').length,
    startTime: conversation.metadata.startTime,
    lastActivity: conversation.metadata.lastActivity,
    duration: new Date().getTime() - new Date(conversation.metadata.startTime).getTime()
  };
  
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
}, 'fetching conversation stats'));

// GET /api/conversations/stats/overview - Get overall conversation statistics
router.get('/stats/overview', ErrorHandler.asyncHandler(async (req, res) => {
  await ensureInitialized();
  
  const stats = await conversationStore.getConversationStats();
  
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
}, 'fetching conversation overview stats'));

// POST /api/conversations/chat - Process a message with conversational AI logic
router.post('/chat', ErrorHandler.asyncHandler(async (req, res) => {
  const { message, conversationId, userId = 'default-user' } = req.body;
  

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid message',
      message: 'Message is required and must be a string'
    });
  }
  
  await ensureInitialized();
  
  if (!chatEngine) {
    throw new Error('Chat engine not initialized');
  }
  
  let currentConversationId = conversationId;
  let isNewConversation = false;
  
  // Handle conversation creation/loading
  if (!currentConversationId) {
    // Create new conversation for first message
    const conversation = conversationStore.createConversation(userId);
    currentConversationId = conversation.id;
    isNewConversation = true;
    console.log(`Created new conversation: ${currentConversationId}`);
    
    // Initialize conversation state in the engine
    await chatEngine['initializeConversationStore']();
    
    // Ensure the conversation is loaded into the chat engine's internal state
    await chatEngine['conversationStore'].loadConversation(currentConversationId);
    
    // Initialize conversation state in the engine
    if (!chatEngine['conversationStates'].has(currentConversationId)) {
      chatEngine['conversationStates'].set(currentConversationId, {
        currentTool: undefined,
        collectedParameters: {},
        missingRequiredFields: [],
        suggestedOptionalFields: [],
        conversationContext: [],
        lastActivity: new Date()
      });
    }
  } else {
    // Load existing conversation
    const existingConversation = await conversationStore.loadConversation(currentConversationId);
    if (!existingConversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: `Conversation with ID "${currentConversationId}" not found`
      });
    }
    console.log(`Loaded existing conversation: ${currentConversationId} with ${existingConversation.messages.length} messages`);
    
    // Ensure the conversation is loaded into the chat engine's internal state
    await chatEngine['conversationStore'].loadConversation(currentConversationId);
    
    // Initialize conversation state in the engine if it doesn't exist
    if (!chatEngine['conversationStates'].has(currentConversationId)) {
      chatEngine['conversationStates'].set(currentConversationId, {
        currentTool: undefined,
        collectedParameters: {},
        missingRequiredFields: [],
        suggestedOptionalFields: [],
        conversationContext: [],
        lastActivity: new Date()
      });
    }
  }
  
  // Add user message to conversation
  conversationStore.addMessage(currentConversationId, 'user', message);
  
  // Use the full ConversationalEngine to process the message (user and assistant messages handled by API route)
  const response = await chatEngine.processMessage(currentConversationId, message, false, false);
  
  // Add assistant response to conversation
  conversationStore.addMessage(currentConversationId, 'assistant', response.message);
  
  // Save the conversation
  await conversationStore.saveConversation(currentConversationId);
  
  // Get updated conversation info for response
  const updatedConversation = await conversationStore.loadConversation(currentConversationId);
  
  res.json({
    success: true,
    data: {
      conversationId: currentConversationId,
      isNewConversation,
      userMessage: {
        content: message,
        timestamp: new Date().toISOString()
      },
      assistantResponse: {
        content: response.message,
        toolMatch: response.toolMatch,
        needsClarification: response.needsClarification,
        clarificationRequest: response.clarificationRequest,
        executionResult: response.executionResult,
        timestamp: new Date().toISOString()
      },
      conversation: {
        id: currentConversationId,
        title: updatedConversation?.metadata?.title || 'New Conversation',
        messageCount: updatedConversation?.messages.length || 0,
        lastMessage: response.message.substring(0, 100) + (response.message.length > 100 ? '...' : ''),
        lastActivity: new Date().toISOString()
      }
    },
    message: 'Message processed successfully',
    timestamp: new Date().toISOString()
  });
  
}, 'processing chat message'));

// Enhanced endpoint to update conversation title
router.patch('/:id/title', ErrorHandler.asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  
  if (!title || typeof title !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Title is required and must be a string'
    });
  }
  
  await ensureInitialized();
  
  const conversation = await conversationStore.loadConversation(id);
  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }
  
  // Update title in metadata
  if (!conversation.metadata) {
    conversation.metadata = {
      startTime: new Date(),
      lastActivity: new Date()
    };
  }
  conversation.metadata.title = title;
  conversation.metadata.lastActivity = new Date();
  
  await conversationStore.saveConversation(id);
  
  res.json({
    success: true,
    data: {
      id: conversation.id,
      title: title,
      messageCount: conversation.messages.length
    },
    message: 'Conversation title updated successfully'
  });
  
}, 'updating conversation title'));

export { router as conversationsRouter };
