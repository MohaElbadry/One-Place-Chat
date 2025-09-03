import { ConversationalEngine } from '../../../src/core/ConversationalEngine.ts';
import { ChromaDBService } from '../../../src/database/ChromaDBService.ts';
import { ChromaDBToolMatcher } from '../../../src/tools/ChromaDBToolMatcher.ts';
import { CurlCommandExecutor } from '../../../src/tools/CurlCommandExecutor.ts';
import { LLMProvider } from '../../../src/core/LLMProvider.ts';

// Mock dependencies
jest.mock('../../../src/database/ChromaDBService');
jest.mock('../../../src/tools/ChromaDBToolMatcher');
jest.mock('../../../src/tools/CurlCommandExecutor');
jest.mock('../../../src/core/LLMProvider');

describe('ConversationalEngine', () => {
  let engine: ConversationalEngine;
  let mockChromaService: jest.Mocked<ChromaDBService>;
  let mockToolMatcher: jest.Mocked<ChromaDBToolMatcher>;
  let mockExecutor: jest.Mocked<CurlCommandExecutor>;
  let mockLLM: jest.Mocked<LLMProvider>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockChromaService = new ChromaDBService() as jest.Mocked<ChromaDBService>;
    mockToolMatcher = new ChromaDBToolMatcher() as jest.Mocked<ChromaDBToolMatcher>;
    mockExecutor = new CurlCommandExecutor() as jest.Mocked<CurlCommandExecutor>;
    mockLLM = new LLMProvider({} as any) as jest.Mocked<LLMProvider>;

    // Mock initialization
    mockChromaService.initialize = jest.fn().mockResolvedValue(undefined);
    mockToolMatcher.initialize = jest.fn().mockResolvedValue(undefined);

    // Create engine instance
    engine = new ConversationalEngine('gpt-4');
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
        tool: global.testUtils.createMockTool(),
        parameters: { testParam: 'test value' },
        confidence: 0.8,
        reasoning: 'Test reasoning'
      });

      // Mock LLM response
      mockLLM.generateResponse = jest.fn().mockResolvedValue(
        global.testUtils.createMockLLMResponse()
      );

      // Mock executor
      mockExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        body: { result: 'success' }
      });
    });

    it('should process a simple message', async () => {
      const response = await engine.processMessage(conversationId, 'Test message');
      
      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.conversationId).toBe(conversationId);
    });

    it('should handle tool matching', async () => {
      const response = await engine.processMessage(conversationId, 'Get test data');
      
      expect(mockToolMatcher.findBestMatch).toHaveBeenCalled();
      expect(response.toolMatch).toBeDefined();
    });

    it('should handle missing required parameters', async () => {
      // Mock tool with required parameters
      const toolWithRequired = global.testUtils.createMockTool();
      toolWithRequired.inputSchema.required = ['testParam', 'requiredParam'];
      
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
      const tool = global.testUtils.createMockTool();
      tool.inputSchema.required = ['testParam'];
      
      mockToolMatcher.findBestMatch = jest.fn().mockResolvedValue({
        tool,
        parameters: { testParam: 'test value' },
        confidence: 0.8,
        reasoning: 'Test reasoning'
      });

      const response = await engine.processMessage(conversationId, 'Get test data with testParam=test value');
      
      expect(mockExecutor.execute).toHaveBeenCalled();
      expect(response.executionResult).toBeDefined();
    });

    it('should handle execution errors', async () => {
      mockExecutor.execute = jest.fn().mockResolvedValue({
        success: false,
        error: 'Execution failed'
      });

      const response = await engine.processMessage(conversationId, 'Get test data');
      
      expect(response.message).toContain('error');
    });

    it('should handle low confidence tool matches', async () => {
      mockToolMatcher.findBestMatch = jest.fn().mockResolvedValue({
        tool: global.testUtils.createMockTool(),
        parameters: {},
        confidence: 0.3, // Low confidence
        reasoning: 'Low confidence match'
      });

      const response = await engine.processMessage(conversationId, 'Unclear request');
      
      expect(response.needsClarification).toBe(true);
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
      const mockConversation = global.testUtils.createMockConversation();
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

      await expect(
        engine.processMessage(conversationId, 'Test message')
      ).rejects.toThrow('Tool matching failed');
    });

    it('should handle LLM errors', async () => {
      const conversationId = engine.startConversation();
      
      mockLLM.generateResponse = jest.fn().mockRejectedValue(
        new Error('LLM request failed')
      );

      await expect(
        engine.processMessage(conversationId, 'Test message')
      ).rejects.toThrow('LLM request failed');
    });
  });

  describe('cleanup', () => {
    it('should destroy engine and cleanup resources', async () => {
      const mockDestroy = jest.fn().mockResolvedValue(undefined);
      (engine as any).conversationStore = { close: mockDestroy };
      (engine as any).toolMatcher = { close: mockDestroy };
      (engine as any).chromaService = { close: mockDestroy };
      
      await engine.destroy();
      
      expect(mockDestroy).toHaveBeenCalledTimes(3);
    });
  });
});
