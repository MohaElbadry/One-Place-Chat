# Configuration Guide

This document explains all the configuration options available for the One-Place-Chat backend.

## Environment Variables

Create a `.env` file in the backend root directory with the following variables:

### Application Configuration
```bash
NODE_ENV=development                    # Environment: development, production, test
APP_VERSION=1.0.0                      # Application version
```

### API Configuration
```bash
PORT=3001                              # API server port
FRONTEND_URL=http://localhost:3000     # Frontend URL for CORS
REQUEST_TIMEOUT_MS=30000              # Request timeout in milliseconds
MAX_REQUEST_SIZE=10mb                  # Maximum request size
```

### Conversational Engine Configuration
```bash
MIN_CONFIDENCE_THRESHOLD=0.6          # Minimum confidence for tool matching (0.0-1.0)
CONVERSATION_TIMEOUT_MS=1800000       # Conversation timeout (30 minutes)
CLEANUP_INTERVAL_MS=300000            # Cleanup interval (5 minutes)
MAX_RETRIES=3                         # Maximum retry attempts
RETRY_DELAY_MS=1000                   # Delay between retries
```

### Security Configuration
```bash
ENABLE_HELMET=true                     # Enable security headers
ENABLE_CORS=true                       # Enable CORS
ENABLE_RATE_LIMIT=true                # Enable rate limiting
JWT_SECRET=your-secret-key            # JWT secret (change in production!)
JWT_EXPIRES_IN=24h                    # JWT expiration time
```

### Logging Configuration
```bash
LOG_LEVEL=info                         # Log level: debug, info, warn, error
ENABLE_MORGAN=true                     # Enable HTTP request logging
ENABLE_CONSOLE_LOGS=true              # Enable console logging
ENABLE_FILE_LOGS=false                # Enable file logging
LOG_FILE_PATH=./logs/app.log          # Log file path
```

### Performance Configuration
```bash
ENABLE_COMPRESSION=true               # Enable response compression
ENABLE_CACHING=true                   # Enable caching
CACHE_TTL_MS=300000                  # Cache TTL (5 minutes)
MAX_MEMORY_USAGE_MB=512              # Maximum memory usage
```

### OpenAI Configuration
```bash
OPENAI_API_KEY=your-api-key          # OpenAI API key (required)
```

### ChromaDB Configuration
```bash
CHROMADB_HOST=localhost               # ChromaDB host
CHROMADB_PORT=8000                    # ChromaDB port
CHROMADB_PATH=http://localhost:8000   # ChromaDB path
CHROMADB_AUTO_CLEANUP=true           # Enable auto cleanup
CHROMADB_CLEANUP_INTERVAL=24         # Cleanup interval in hours
CHROMADB_MAX_CONVERSATION_AGE=168    # Max conversation age in hours
```

## Configuration Validation

The application will validate required configuration values on startup. Missing required values will cause the application to fail to start.

## Environment-Specific Configurations

### Development
- Debug logging enabled
- Console logging enabled
- Relaxed security settings

### Production
- Warning level logging
- Console logging disabled
- Strict security settings
- Rate limiting enabled

### Testing
- Minimal logging
- Test-specific configurations

## Security Notes

1. **NEVER commit your `.env` file to version control**
2. **Change JWT_SECRET in production**
3. **Use strong, unique API keys**
4. **Enable all security features in production**

## Example .env File

```bash
# Copy this to .env and fill in your values
NODE_ENV=development
APP_VERSION=1.0.0
PORT=3001
FRONTEND_URL=http://localhost:3000
MIN_CONFIDENCE_THRESHOLD=0.6
OPENAI_API_KEY=your-openai-api-key-here
JWT_SECRET=your-secret-key-change-in-production
```
