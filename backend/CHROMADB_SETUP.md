# ChromaDB Integration Setup Guide

This guide will help you set up ChromaDB as a persistent vector database for your One-Place-Chat backend.

## 🚀 Quick Start

### Option 1: Docker (Recommended)

1. **Start ChromaDB with Docker Compose:**
   ```bash   cd backend
   docker-compose -f docker-compose.chromadb.yml up -d
   ```

2. **Verify ChromaDB is running:**
   ```bash
   curl http://localhost:8000/api/v1/heartbeat
   ```

### Option 2: Local Installation

1. **Install ChromaDB:**
   ```bash
   pip install chromadb
   ```

2. **Start ChromaDB server:**
   ```bash
   chroma run --host localhost --port 8000 --path ./chroma_db
   ```

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# ChromaDB Configuration
CHROMADB_HOST=localhost
CHROMADB_PORT=8000
CHROMADB_PATH=http://localhost:8000
CHROMADB_AUTO_CLEANUP=true
CHROMADB_CLEANUP_INTERVAL=24
CHROMADB_MAX_CONVERSATION_AGE=168

# Database Configuration
DB_TYPE=chromadb
DB_PERSISTENCE=true
```

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `CHROMADB_HOST` | `localhost` | ChromaDB server hostname |
| `CHROMADB_PORT` | `8000` | ChromaDB server port |
| `CHROMADB_PATH` | `http://localhost:8000` | Full ChromaDB URL |
| `CHROMADB_AUTO_CLEANUP` | `true` | Enable automatic cleanup of old data |
| `CHROMADB_CLEANUP_INTERVAL` | `24` | Cleanup interval in hours |
| `CHROMADB_MAX_CONVERSATION_AGE` | `168` | Max conversation age in hours (1 week) |

## 📊 Database Schema

### Tools Collection
- **ID**: Unique identifier for each tool
- **Tool**: Complete MCPTool object (serialized as JSON)
- **Embedding**: 1536-dimensional vector from OpenAI embeddings
- **Metadata**: Tool name, description, tags, method, path, timestamps

### Conversations Collection
- **ID**: Unique identifier for each conversation record
- **ConversationID**: Original conversation identifier
- **Messages**: Array of conversation messages
- **Embedding**: Simple hash-based embedding for similarity search
- **Metadata**: Start time, last activity, user preferences, message count, timestamps

## 🔄 Migration from File Storage

### Automatic Migration

The new ChromaDB services will automatically migrate your existing data:

1. **Tools**: Existing JSON files in `generated-tools/` will be loaded and embedded
2. **Conversations**: Existing JSON files in `conversations/` will be loaded and stored

### Manual Migration

If you need to manually migrate data:

```bash
# Run the migration script
node scripts/setup-chromadb.js

# Or use the CLI
npm run migrate-to-chromadb
```

## 🧠 Embedding Generation

### Tool Embeddings
- Generated using OpenAI's `text-embedding-ada-002` model
- Combines tool name, description, tags, method, and path
- Stored as 1536-dimensional vectors

### Conversation Embeddings
- Simple hash-based embeddings for basic similarity
- Can be enhanced with LLM embeddings for better semantic search
- Optimized for conversation context retrieval

## 📈 Performance Features

### Caching
- Embedding cache with TTL (30 minutes default)
- Query result caching for repeated searches
- Automatic cache cleanup and size management

### Batch Processing
- Batch embedding generation for multiple tools
- Concurrent API calls with rate limiting
- Progress tracking for large operations

### Search Optimization
- Multi-factor scoring (semantic, keyword, intent, path)
- Configurable similarity thresholds
- Fallback to keyword matching when embeddings fail

## 🔍 Usage Examples

### Initialize ChromaDB Service

```typescript
import { ChromaDBService } from './database/ChromaDBService';
import { ToolEmbeddingMatcherChroma } from './tools/ToolEmbeddingMatcherChroma';

const chromaService = new ChromaDBService();
await chromaService.initialize();

const toolMatcher = new ToolEmbeddingMatcherChroma(openaiApiKey, chromaService);
await toolMatcher.initialize(tools);
```

### Store Tool Embeddings

```typescript
// Automatically done during initialization
await toolMatcher.addTool(newTool);

// Or manually
const embedding = await toolMatcher.embed(toolDescription);
await chromaService.storeToolEmbedding(tool, embedding);
```

### Find Similar Tools

```typescript
const similarTools = await toolMatcher.findSimilarTools("get user information", 5);
console.log(`Found ${similarTools.length} similar tools`);
```

### Store Conversations

```typescript
import { ConversationStoreChroma } from './core/ConversationStoreChroma';

const conversationStore = new ConversationStoreChroma(chromaService);
await conversationStore.initialize();

const conversation = conversationStore.createConversation();
conversationStore.addMessage(conversation.id, 'user', 'Hello, how can you help me?');
```

## 🧪 Testing

### Test Database Connection

```bash
# Test ChromaDB server
curl http://localhost:8000/api/v1/heartbeat

# Test from your application
npm run test:chromadb
```

### Test Tool Matching

```bash
# Start chat interface
npm run chat

# Try queries like:
# "Get user information"
# "Create a new pet"
# "Find available pets"
```

## 🚨 Troubleshooting

### Common Issues

1. **ChromaDB Connection Failed**
   - Check if server is running: `curl http://localhost:8000/api/v1/heartbeat`
   - Verify port 8000 is not blocked
   - Check Docker container status: `docker ps`

2. **Embedding Generation Failed**
   - Verify OpenAI API key is set
   - Check API rate limits
   - Ensure sufficient API credits

3. ** Performance Issues**
   - Increase `EMBEDDING_BATCH_SIZE`
   - Reduce `MAX_CONCURRENT_EMBEDDINGS`
   - Check system resources

### Debug Mode

Enable debug logging:

```bash
DEBUG=chromadb:* npm run chat
```

### Reset Database

```bash
# Clear all data
npm run reset-chromadb

# Or manually
curl -X DELETE http://localhost:8000/api/v1/collections/tools
curl -X DELETE http://localhost:8000/api/v1/collections/conversations
```

## 📚 API Reference

### ChromaDBService

- `initialize()`: Initialize database connection
- `storeToolEmbedding(tool, embedding)`: Store tool with embedding
- `findSimilarTools(query, embedding, limit)`: Find similar tools
- `storeConversation(conversation)`: Store conversation
- `getDatabaseStats()`: Get database statistics

### ToolEmbeddingMatcherChroma

- `initialize(tools)`: Initialize with tool array
- `findBestMatch(message)`: Find best matching tool
- `findSimilarTools(query, limit)`: Find similar tools
- `addTool(tool)`: Add new tool
- `getMetrics()`: Get performance metrics

### ConversationStoreChroma

- `initialize()`: Initialize conversation store
- `createConversation(userId?)`: Create new conversation
- `addMessage(conversationId, role, content)`: Add message
- `searchConversations(query, limit)`: Search conversations
- `getConversationStats()`: Get conversation statistics

## 🔮 Future Enhancements

- **Multi-modal embeddings**: Support for images, audio, and other media
- **Advanced indexing**: Hierarchical clustering and semantic indexing
- **Real-time sync**: WebSocket-based real-time updates
- **Distributed deployment**: Multi-node ChromaDB clusters
- **Advanced analytics**: Usage patterns and performance insights

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review ChromaDB documentation: https://docs.trychroma.com/
3. Open an issue in the project repository
4. Check the logs for detailed error messages
