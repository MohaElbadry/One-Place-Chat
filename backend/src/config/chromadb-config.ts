export interface ChromaDBConfig {
  host: string;
  port: number;
  path: string;
  collectionNames: {
    tools: string;
    conversations: string;
  };
  embeddingModel: string;
  maxResults: number;
  similarityThreshold: number;
  autoCleanup: boolean;
  cleanupIntervalHours: number;
  maxConversationAgeHours: number;
}

export const defaultChromaDBConfig: ChromaDBConfig = {
  host: 'localhost',
  port: 8000,
  path: 'http://localhost:8000',
  collectionNames: {
    tools: 'tools',
    conversations: 'conversations'
  },
  embeddingModel: 'text-embedding-ada-002',
  maxResults: 10,
  similarityThreshold: 0.6,
  autoCleanup: true,
  cleanupIntervalHours: 24,
  maxConversationAgeHours: 168 // 1 week
};

export function getChromaDBConfig(): ChromaDBConfig {
  // You can override defaults with environment variables
  return {
    ...defaultChromaDBConfig,
    host: process.env.CHROMADB_HOST || defaultChromaDBConfig.host,
    port: parseInt(process.env.CHROMADB_PORT || defaultChromaDBConfig.port.toString()),
    path: process.env.CHROMADB_PATH || defaultChromaDBConfig.path,
    autoCleanup: process.env.CHROMADB_AUTO_CLEANUP !== 'false',
    cleanupIntervalHours: parseInt(process.env.CHROMADB_CLEANUP_INTERVAL || defaultChromaDBConfig.cleanupIntervalHours.toString()),
    maxConversationAgeHours: parseInt(process.env.CHROMADB_MAX_CONVERSATION_AGE || defaultChromaDBConfig.maxConversationAgeHours.toString())
  };
}
