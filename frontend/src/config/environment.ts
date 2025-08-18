// Environment configuration
export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
  },
  
  // App Configuration
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'One-Place-Chat',
    version: process.env.NEXT_PUBLIC_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  
  // Feature Flags
  features: {
    enableDebugMode: process.env.NODE_ENV === 'development',
    enableErrorReporting: process.env.NODE_ENV === 'production',
    enablePerformanceMonitoring: process.env.NODE_ENV === 'production',
  },
  
  // UI Configuration
  ui: {
    maxMessageLength: 10000,
    typingIndicatorDelay: 1000,
    autoScrollThreshold: 100,
  }
};

// Type-safe environment getters
export const getApiUrl = () => config.api.baseUrl;
export const getAppName = () => config.app.name;
export const getAppVersion = () => config.app.version;
export const isDevelopment = () => config.app.environment === 'development';
export const isProduction = () => config.app.environment === 'production';
