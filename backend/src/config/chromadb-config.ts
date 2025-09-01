import dotenv from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
const environment = process.env.NODE_ENV || 'development';
const envFile = environment === 'production' ? '.env.production' : '.env.development';

// Load environment file
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Load local overrides if they exist
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

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
    tools: 'oneplacechat_tools',
    conversations: 'oneplacechat_conversations'
  },
  embeddingModel: 'text-embedding-ada-002',
  maxResults: 10,
  similarityThreshold: 0.6,
  autoCleanup: true,
  cleanupIntervalHours: 24,
  maxConversationAgeHours: 168 // 1 week
};

export function getChromaDBConfig(): ChromaDBConfig {
  // Override defaults with environment variables
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
