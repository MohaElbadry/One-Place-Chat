import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(process.cwd(), '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock external services
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Test response'
            }
          }]
        })
      }
    }
  }))
}));

// Mock ChromaDB
jest.mock('chromadb', () => ({
  ChromaClient: jest.fn().mockImplementation(() => ({
    getOrCreateCollection: jest.fn().mockResolvedValue({
      add: jest.fn(),
      get: jest.fn().mockResolvedValue({
        ids: ['test-id'],
        embeddings: [[0.1, 0.2, 0.3]],
        metadatas: [{ test: 'metadata' }],
        documents: ['test document']
      }),
      query: jest.fn().mockResolvedValue({
        ids: [['test-id']],
        embeddings: [[[0.1, 0.2, 0.3]]],
        metadatas: [[{ test: 'metadata' }]],
        documents: [['test document']],
        distances: [[0.1]]
      }),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(1)
    }),
    listCollections: jest.fn().mockResolvedValue([
      { name: 'test-collection' }
    ]),
    deleteCollection: jest.fn()
  }))
}));

// Global test utilities
global.testUtils = {
  createMockTool: () => ({
    name: 'test-tool',
    description: 'Test tool description',
    inputSchema: {
      type: 'object',
      properties: {
        testParam: {
          type: 'string',
          description: 'Test parameter'
        }
      },
      required: ['testParam']
    },
    annotations: {
      method: 'GET',
      path: '/test',
      tags: ['test'],
      deprecated: false,
      title: 'Test Tool',
      openWorldHint: false,
      readOnlyHint: true
    },
    endpoint: {
      method: 'GET',
      path: '/test',
      baseUrl: 'https://api.test.com'
    },
    security: []
  }),

  createMockConversation: () => ({
    id: 'test-conversation-id',
    messages: [
      {
        id: 'test-message-1',
        role: 'user',
        content: 'Test user message',
        timestamp: new Date()
      },
      {
        id: 'test-message-2',
        role: 'assistant',
        content: 'Test assistant response',
        timestamp: new Date()
      }
    ],
    metadata: {
      startTime: new Date(),
      lastActivity: new Date(),
      title: 'Test Conversation',
      messageCount: 2
    }
  }),

  createMockLLMResponse: () => ({
    content: 'Test LLM response',
    model: 'gpt-4',
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15
    }
  }),

  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export {};
