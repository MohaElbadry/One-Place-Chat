# One-Place-Chat REST API Setup Guide

This guide will help you set up and run the REST API server for One-Place-Chat.

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

1. **Run the setup script**:
   ```bash
   cd backend
   ./setup-api.sh
   ```

   This script will:
   - Check Node.js version
   - Install dependencies
   - Build the project
   - Start ChromaDB (if not running)
   - Start the API server

### Option 2: Manual Setup

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Start ChromaDB**:
   ```bash
   docker-compose -f docker-compose.chromadb.yml up -d
   ```

4. **Start the API server**:
   ```bash
   npm run api:dev
   ```

## 🌐 API Endpoints

### Base URL
```
http://localhost:3001/api
```

### Available Endpoints

#### Tools API
- `GET /api/tools` - Get all tools
- `GET /api/tools/search?q={query}&limit={limit}` - Search tools
- `GET /api/tools/{id}` - Get specific tool
- `GET /api/tools/categories/{category}` - Get tools by category
- `GET /api/tools/stats` - Get tools statistics

#### Conversations API
- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/{id}` - Get specific conversation
- `POST /api/conversations/{id}/messages` - Add message
- `DELETE /api/conversations/{id}` - Delete conversation
- `GET /api/conversations/{id}/stats` - Get conversation stats
- `GET /api/conversations/stats/overview` - Get overview stats

#### Health API
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health with services
- `GET /api/health/ready` - Readiness probe

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# API Server Configuration
API_PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# ChromaDB Configuration
CHROMADB_HOST=localhost
CHROMADB_PORT=8000
CHROMADB_PATH=http://localhost:8000

# LLM Configuration
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

### Port Configuration

The API server runs on port 3001 by default. You can change this by:

1. Setting the `API_PORT` environment variable
2. Modifying the default in `src/api/server.ts`

## 📊 API Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "count": 10,
  "limit": 50,
  "offset": 0,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

## 🧪 Testing the API

### 1. Health Check
```bash
curl http://localhost:3001/api/health
```

### 2. Get All Tools
```bash
curl http://localhost:3001/api/tools
```

### 3. Search Tools
```bash
curl "http://localhost:3001/api/tools/search?q=pet&limit=5"
```

### 4. Get Conversations
```bash
curl http://localhost:3001/api/conversations
```

### 5. Create Conversation
```bash
curl -X POST http://localhost:3001/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Conversation"}'
```

## 🔍 API Features

### Pagination
Many endpoints support pagination with `limit` and `offset` parameters:

```bash
# Get first 20 tools
curl "http://localhost:3001/api/tools?limit=20&offset=0"

# Get next 20 tools
curl "http://localhost:3001/api/tools?limit=20&offset=20"
```

### Search
Tools and conversations support search functionality:

```bash
# Search tools by query
curl "http://localhost:3001/api/tools/search?q=user&limit=10"

# Search conversations
curl "http://localhost:3001/api/conversations?search=hello&limit=20"
```

### Filtering
Tools can be filtered by category:

```bash
# Get tools by category
curl "http://localhost:3001/api/tools/categories/pet"
```

## 🚨 Error Handling

The API provides comprehensive error handling:

- **400 Bad Request**: Invalid parameters or missing required fields
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side errors
- **503 Service Unavailable**: Service not ready (e.g., ChromaDB unavailable)

### Common Error Scenarios

1. **ChromaDB Unavailable**: Check if ChromaDB is running
2. **Invalid Tool ID**: Ensure the tool exists
3. **Missing Parameters**: Check required fields in request body
4. **Service Initialization**: Wait for services to be ready

## 🔒 Security Features

- **CORS**: Configured for frontend access
- **Helmet**: Security headers
- **Input Validation**: Request parameter validation
- **Rate Limiting**: Built-in request limiting (configurable)

## 📈 Performance

- **Caching**: Tool embeddings and search results cached
- **Pagination**: Large result sets are paginated
- **Async Processing**: Non-blocking operations
- **Connection Pooling**: Efficient database connections

## 🐛 Troubleshooting

### API Server Won't Start

1. **Check port availability**:
   ```bash
   lsof -i :3001
   ```

2. **Check Node.js version**:
   ```bash
   node --version
   ```

3. **Check dependencies**:
   ```bash
   npm list
   ```

### ChromaDB Connection Issues

1. **Check ChromaDB status**:
   ```bash
   curl http://localhost:8000/api/v1/heartbeat
   ```

2. **Start ChromaDB**:
   ```bash
   docker-compose -f docker-compose.chromadb.yml up -d
   ```

3. **Check Docker logs**:
   ```bash
   docker-compose -f docker-compose.chromadb.yml logs
   ```

### Tools Not Loading

1. **Check if tools exist**:
   ```bash
   curl http://localhost:3001/api/tools/stats
   ```

2. **Generate tools from OpenAPI specs**:
   ```bash
   npm run generate-tools-chromadb
   ```

3. **Check ChromaDB collections**:
   ```bash
   curl http://localhost:8000/api/v1/collections
   ```

## 🔄 Development Workflow

1. **Start ChromaDB**: `docker-compose -f docker-compose.chromadb.yml up -d`
2. **Generate tools**: `npm run generate-tools-chromadb`
3. **Start API server**: `npm run api:dev`
4. **Test endpoints**: Use curl or Postman
5. **Frontend integration**: Update frontend to use new API

## 📚 Next Steps

- [ ] Add authentication and authorization
- [ ] Implement WebSocket for real-time updates
- [ ] Add API rate limiting
- [ ] Implement request logging and monitoring
- [ ] Add API documentation with Swagger/OpenAPI
- [ ] Implement caching layer (Redis)
- [ ] Add metrics and analytics

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the logs for detailed error messages
3. Check ChromaDB and Docker status
4. Verify environment variables are set correctly
