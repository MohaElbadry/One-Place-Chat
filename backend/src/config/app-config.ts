import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Centralized application configuration
 * Makes all thresholds, timeouts, and settings configurable
 */
export const appConfig = {
  // Conversational Engine Configuration
  conversational: {
    minConfidenceThreshold: parseFloat(process.env.MIN_CONFIDENCE_THRESHOLD || '0.55'),
    conversationTimeoutMs: parseInt(process.env.CONVERSATION_TIMEOUT_MS || '1800000'), // 30 minutes
    cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '300000'), // 5 minutes
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000'),
  },

  // API Configuration
  api: {
    port: parseInt(process.env.PORT || '3001'),
    corsOrigin: process.env.FRONTEND_URL || 'http://localhost:3000',
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'),
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  },

  // Security Configuration
  security: {
    enableHelmet: process.env.ENABLE_HELMET !== 'false',
    enableCors: process.env.ENABLE_CORS !== 'false',
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableMorgan: process.env.ENABLE_MORGAN !== 'false',
    enableConsoleLogs: process.env.ENABLE_CONSOLE_LOGS !== 'false',
    enableFileLogs: process.env.ENABLE_FILE_LOGS === 'true',
    logFilePath: process.env.LOG_FILE_PATH || './logs/app.log',
  },

  // Performance Configuration
  performance: {
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    enableCaching: process.env.ENABLE_CACHING !== 'false',
    cacheTtlMs: parseInt(process.env.CACHE_TTL_MS || '300000'), // 5 minutes
    maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE_MB || '512'),
  },

  // Environment
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Version
  version: process.env.APP_VERSION || '1.0.0',
};

/**
 * Get configuration value with type safety
 */
export function getConfig<T>(key: string, defaultValue: T): T {
  const keys = key.split('.');
  let value: any = appConfig;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return defaultValue;
    }
  }
  
  return value as T;
}

