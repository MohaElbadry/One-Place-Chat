import { ConversationalEngine } from '../../../src/core/ConversationalEngine.js';
import { ChromaDBService } from '../../../src/database/ChromaDBService.js';
import { ChromaDBToolMatcher } from '../../../src/tools/ChromaDBToolMatcher.js';
import { CurlCommandExecutor } from '../../../src/tools/CurlCommandExecutor.js';
import { LLMProvider } from '../../../src/core/LLMProvider.js';
import { ChromaDBToolLoader } from '../../../src/tools/ChromaDBToolLoader.js';

// Mock dependencies
jest.mock('../../../src/database/ChromaDBService.js');
jest.mock('../../../src/tools/ChromaDBToolMatcher.js');
jest.mock('../../../src/tools/CurlCommandExecutor.js');
jest.mock('../../../src/core/LLMProvider.js');
jest.mock('../../../src/tools/ChromaDBToolLoader.js');

// Mock the ChromaDBToolLoader constructor
const MockedChromaDBToolLoader = ChromaDBToolLoader as jest.MockedClass<typeof ChromaDBToolLoader>;

describe('ConversationalEngine', () => {
  let engine: ConversationalEngine;
  let mockChromaService: jest.Mocked<ChromaDBService>;
  let mockToolMatcher: jest.Mocked<ChromaDBToolMatcher>;
  let mockExecutor: jest.Mocked<CurlCommandExecutor>;
  let mockLLM: jest.Mocked<LLMProvider>;
  let mockToolLoader: jest.Mocked<ChromaDBToolLoader>;

  // Mock tools for testing
  const mockTools = [
    {
      name: 'test-tool',
      description: 'Test tool for unit testing',
      endpoint: { method: 'GET', path: '/test' },
      inputSchema: { 
        properties: { 
          testParam: { type: 'string', description: 'Test parameter' },
          requiredParam: { type: 'string', description: 'Required parameter' }
        }, 
        required: ['testParam'] 
      }
    }
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockChromaService = new ChromaDBService() as jest.Mocked<ChromaDBService>;
    mockToolMatcher = new ChromaDBToolMatcher() as jest.Mocked<ChromaDBToolMatcher>;
    mockExecutor = new CurlCommandExecutor() as jest.Mocked<CurlCommandExecutor>;
    mockLLM = new LLMProvider({} as any) as jest.Mocked<LLMProvider>;
    mockToolLoader = new ChromaDBToolLoader() as jest.Mocked<ChromaDBToolLoader>;

    // Mock initialization
    mockChromaService.initialize = jest.fn().mockResolvedValue(undefined);
    mockToolMatcher.initialize = jest.fn().mockResolvedValue(undefined);
    
    // Mock tool matcher methods
    mockToolMatcher.findBestMatch = jest.fn().mockResolvedValue({
      tool: mockTools[0],
      parameters: { testParam: 'test value' },
      confidence: 0.9,
      reasoning: 'Test reasoning'
    });
    
    // Mock LLM provider methods
    mockLLM.generateResponse = jest.fn().mockResolvedValue({
      content: '{"testParam": "test value"}',
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    });
    
    // Mock executor methods
    mockExecutor.executeCurl = jest.fn().mockResolvedValue('{"result": "test execution result"}');
    
    // Mock tool loader methods
    mockToolLoader.loadTools = jest.fn().mockResolvedValue(mockTools);
    
    // Mock the ChromaDBToolLoader constructor to return our mock
    MockedChromaDBToolLoader.mockImplementation(() => mockToolLoader);

    // Create engine instance
    engine = new ConversationalEngine('gpt-4');
    
    // Replace the toolMatcher, LLM, and executor with our mocks after creation
    (engine as any).toolMatcher = mockToolMatcher;
    (engine as any).llm = mockLLM;
    (engine as any).executor = mockExecutor;
    
    // Mock the conversation store to be initialized
    (engine as any).conversationStore.isInitialized = true;
    let conversationCounter = 0;
    (engine as any).conversationStore.createConversation = jest.fn().mockImplementation(() => ({
      id: `test-conversation-id-${++conversationCounter}`,
      messages: []
    }));
    (engine as any).conversationStore.addMessage = jest.fn();
    (engine as any).conversationStore.saveConversation = jest.fn().mockResolvedValue(undefined);
    (engine as any).conversationStore.loadConversation = jest.fn().mockResolvedValue({});
    (engine as any).conversationStore.listConversations = jest.fn().mockResolvedValue([]);
    (engine as any).conversationStore.close = jest.fn().mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should initialize with default model', () => {
      const defaultEngine = new ConversationalEngine();
      expect(defaultEngine).toBeInstanceOf(ConversationalEngine);
    });

    it('should initialize with specified model', () => {
      expect(engine).toBeInstanceOf(ConversationalEngine);
    });
  });

  describe('startConversation', () => {
    it('should create a new conversation', async () => {
      const conversationId = engine.startConversation();
      
      expect(conversationId).toBeDefined();
      expect(typeof conversationId).toBe('string');
      expect(conversationId.length).toBeGreaterThan(0);
    });

    it('should create unique conversation IDs', () => {
      const id1 = engine.startConversation();
      const id2 = engine.startConversation();
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('processMessage', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = engine.startConversation();
      
      // Mock tool matcher to return a tool
      mockToolMatcher.findBestMatch = jest.fn().mockResolvedValue({
        tool: {
          name: 'test-tool',
          description: 'Test tool',
          endpoint: { method: 'GET', path: '/test' },
          inputSchema: { properties: {}, required: [] }
        },
        parameters: { testParam: 'test value' },
        confidence: 0.8,
        reasoning: 'Test reasoning'
      });

      // Mock LLM response
      mockLLM.generateResponse = jest.fn().mockResolvedValue({
        content: '{"testParam": "test value"}',
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      });

      // Mock executor
      mockExecutor.executeCurl = jest.fn().mockResolvedValue('{"result": "success"}');
    });

    it('should process a simple message', async () => {
      const response = await engine.processMessage(conversationId, 'Test message');
      
      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.conversationId).toBe(conversationId);
    });

    it('should handle tool matching', async () => {
      const response = await engine.processMessage(conversationId, 'Get test data');
      
      // The tool matcher should be called when tools are available
      expect(mockToolMatcher.findBestMatch).toHaveBeenCalled();
      
      // The response should contain information about available tools
      expect(response.message).toContain('test-tool');
    });

    it('should handle missing required parameters', async () => {
      // Mock tool with required parameters
      const toolWithRequired = {
        name: 'test-tool',
        description: 'Test tool',
        endpoint: { method: 'GET', path: '/test' },
        inputSchema: { 
          properties: { 
            testParam: { type: 'string' },
            requiredParam: { type: 'string' }
          }, 
          required: ['testParam', 'requiredParam'] 
        }
      };
      
      mockToolMatcher.findBestMatch = jest.fn().mockResolvedValue({
        tool: toolWithRequired,
        parameters: { testParam: 'test value' },
        confidence: 0.8,
        reasoning: 'Test reasoning'
      });

      const response = await engine.processMessage(conversationId, 'Get test data');
      
      expect(response.needsClarification).toBe(true);
      expect(response.clarificationRequest).toBeDefined();
    });

    it('should execute tool when all parameters are provided', async () => {
      const tool = {
        name: 'test-tool',
        description: 'Test tool',
        endpoint: { method: 'GET', path: '/test' },
        inputSchema: { 
          properties: { testParam: { type: 'string' } }, 
          required: ['testParam'] 
        }
      };
      
      mockToolMatcher.findBestMatch = jest.fn().mockResolvedValue({
        tool,
        parameters: { testParam: 'test value' },
        confidence: 0.8,
        reasoning: 'Test reasoning'
      });

      const response = await engine.processMessage(conversationId, 'Get test data with testParam=test value');
      
      expect(mockExecutor.executeCurl).toHaveBeenCalled();
      expect(response.toolMatch).toBeDefined();
    });


    it('should handle execution errors', async () => {
      mockExecutor.executeCurl = jest.fn().mockResolvedValue('{"error": "Execution failed"}');

      const response = await engine.processMessage(conversationId, 'Get test data');
      
      expect(response.message.toLowerCase()).toContain('error');
    });

    it('should handle low confidence tool matches', async () => {
      mockToolMatcher.findBestMatch = jest.fn().mockResolvedValue({
        tool: {
          name: 'test-tool',
          description: 'Test tool',
          endpoint: { method: 'GET', path: '/test' },
          inputSchema: { properties: {}, required: [] }
        },
        parameters: {},
        confidence: 0.3, // Low confidence
        reasoning: 'Low confidence match'
      });

      const response = await engine.processMessage(conversationId, 'Unclear request');
      
      // With confidence 0.3 (below threshold 0.55), system should return "no suitable API" message
      expect(response.needsClarification).toBe(false);
      expect(response.message).toContain('suitable API');
    });
  });

  describe('conversation management', () => {
    it('should save conversation', async () => {
      const conversationId = engine.startConversation();
      
      // Mock save method
      const mockSave = jest.fn().mockResolvedValue(undefined);
      (engine as any).conversationStore = { saveConversation: mockSave };
      
      await engine.saveConversation(conversationId);
      
      expect(mockSave).toHaveBeenCalledWith(conversationId);
    });

    it('should load conversation', async () => {
      const mockConversation = {
        id: 'test-id',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockLoad = jest.fn().mockResolvedValue(mockConversation);
      (engine as any).conversationStore = { loadConversation: mockLoad };
      
      const result = await engine.loadConversation('test-id');
      
      expect(mockLoad).toHaveBeenCalledWith('test-id');
      expect(result).toBe(mockConversation);
    });

    it('should list conversations', async () => {
      const mockConversations = [
        { id: 'conv1', lastActivity: new Date(), messageCount: 5 },
        { id: 'conv2', lastActivity: new Date(), messageCount: 3 }
      ];
      const mockList = jest.fn().mockResolvedValue(mockConversations);
      (engine as any).conversationStore = { listConversations: mockList };
      
      const result = await engine.listConversations();
      
      expect(mockList).toHaveBeenCalled();
      expect(result).toBe(mockConversations);
    });
  });

  describe('error handling', () => {
    it('should handle invalid conversation ID', async () => {
      await expect(
        engine.processMessage('invalid-id', 'Test message')
      ).rejects.toThrow();
    });

    it('should handle tool matcher errors', async () => {
      const conversationId = engine.startConversation();
      
      mockToolMatcher.findBestMatch = jest.fn().mockRejectedValue(
        new Error('Tool matching failed')
      );

      // Tool matcher errors are not caught in processNewRequest, so they should be thrown
      await expect(
        engine.processMessage(conversationId, 'Test message')
      ).rejects.toThrow('Tool matching failed');
    });

    it('should handle LLM errors', async () => {
      const conversationId = engine.startConversation();
      
      mockLLM.generateResponse = jest.fn().mockRejectedValue(
        new Error('LLM request failed')
      );

      // LLM errors should be handled gracefully, not thrown
      const response = await engine.processMessage(conversationId, 'Test message');
      
      expect(response).toBeDefined();
      expect(response.conversationId).toBe(conversationId);
      // The system should still provide a response even when LLM fails
      expect(response.message).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should destroy engine and cleanup resources', async () => {
      const mockDestroy = jest.fn().mockResolvedValue(undefined);
      (engine as any).conversationStore = { close: mockDestroy };
      (engine as any).toolMatcher = { close: mockDestroy };
      
      await engine.destroy();
      
      expect(mockDestroy).toHaveBeenCalledTimes(2);
    });
  });
});
