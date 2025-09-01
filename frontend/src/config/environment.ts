// Environment configuration with proper fallbacks
export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000'),
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
    enableDebugMode: process.env.NEXT_PUBLIC_ENABLE_DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development',
    enableErrorReporting: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true' || process.env.NODE_ENV === 'production',
    enablePerformanceMonitoring: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true' || process.env.NODE_ENV === 'production',
    enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  },
  
  // UI Configuration
  ui: {
    maxMessageLength: parseInt(process.env.NEXT_PUBLIC_MAX_MESSAGE_LENGTH || '10000'),
    typingIndicatorDelay: parseInt(process.env.NEXT_PUBLIC_TYPING_INDICATOR_DELAY || '1000'),
    autoScrollThreshold: 100,
  }
};

// Type-safe environment getters
export const getApiUrl = () => config.api.baseUrl;
export const getAppName = () => config.app.name;
export const getAppVersion = () => config.app.version;
export const isDevelopment = () => config.app.environment === 'development';
export const isProduction = () => config.app.environment === 'production';

// Environment validation
export const validateEnvironment = () => {
  const requiredVars = [
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_APP_NAME'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
  }
  
  return missing.length === 0;
};

// Initialize validation
if (typeof window === 'undefined') {
  validateEnvironment();
}
