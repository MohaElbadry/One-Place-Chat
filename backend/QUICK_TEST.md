# 🚀 Quick Test Guide for ChromaDB Integration

## ✅ Prerequisites
- ChromaDB server running on port 8000
- OpenAI API key set in environment
- Node.js dependencies installed

## 🔧 Setup

### 1. Set OpenAI API Key
```bash
export OPENAI_API_KEY="your_openai_api_key_here"
```

### 2. Verify ChromaDB is Running
```bash
curl http://localhost:8000/api/v2/heartbeat
# Should return: {"nanosecond heartbeat":...}
```

## 🧪 Test Commands

### Test 1: Basic Embedding Test
```bash
npm run test-embeddings
```
This creates sample tools, generates embeddings, stores them in ChromaDB, tests semantic search, and cleans up.

### Test 2: Test with Existing Tools
```bash
npm run test-existing-tools
```
This loads your existing tools from `generated-tools/`, generates embeddings for them, and tests semantic search.

### Test 3: Generate Tools with ChromaDB
```bash
# Generate tools from Petstore API and store in ChromaDB
npm run generate-tools-chromadb api-docs/Petstore/swagger.json

# Search for tools
npm run generate-tools-chromadb search "get pet information"
```

## 📊 Expected Results

### Test 1 (Basic Embedding Test)
- ✅ 6 sample tools created
- ✅ Embeddings generated using OpenAI
- ✅ Tools stored in ChromaDB
- ✅ Semantic search working
- ✅ Test data cleaned up

### Test 2 (Existing Tools Test)
- ✅ Loads tools from your `generated-tools/` directory
- ✅ Generates embeddings for real tools
- ✅ Tests semantic search with pet store queries
- ✅ Shows similarity scores

### Test 3 (Tool Generation)
- ✅ Generates tools from OpenAPI spec
- ✅ Creates embeddings automatically
- ✅ Stores in ChromaDB collection
- ✅ Provides semantic search capability

## 🔍 Test Queries to Try

```bash
# Search for specific functionality
npm run generate-tools-chromadb search "create new pet"
npm run generate-tools-chromadb search "get user information"
npm run generate-tools-chromadb search "delete order"
npm run generate-tools-chromadb search "find pets by status"

# List ChromaDB collections
npm run generate-tools-chromadb list-collections
```

## 🚨 Troubleshooting

### Common Issues

1. **ChromaDB Connection Failed**
   ```bash
   # Check if server is running
   curl http://localhost:8000/api/v2/heartbeat
   
   # Start with Docker
   docker-compose -f docker-compose.chromadb.yml up -d
   ```

2. **OpenAI API Key Missing**
   ```bash
   export OPENAI_API_KEY="your_key_here"
   echo $OPENAI_API_KEY  # Verify it's set
   ```

3. **No Tools Found**
   ```bash
   # Check if generated-tools directory exists
   ls -la generated-tools/
   
   # Generate tools first
   npm run generate-tools api-docs/Petstore/swagger.json
   ```

4. **Module Not Found Errors**
   ```bash
   # Install dependencies
   npm install
   
   # Build TypeScript
   npm run build
   ```

## 📈 Performance Tips

- **Rate Limiting**: Scripts include delays to avoid OpenAI API rate limits
- **Batch Processing**: Tools are processed in batches for efficiency
- **Error Handling**: Individual tool failures don't stop the entire process
- **Cleanup**: Test data is automatically cleaned up after tests

## 🎯 Next Steps

After successful testing:

1. **Integrate with ConversationalEngine**: Replace the old embedding matcher
2. **Update ChatInterface**: Use ChromaDB-based conversation store
3. **Production Deployment**: Configure ChromaDB for production use
4. **Monitoring**: Add metrics and monitoring for the vector database

## 📚 Additional Resources

- [ChromaDB Documentation](https://docs.trychroma.com/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Vector Database Best Practices](https://docs.trychroma.com/guides/best-practices)
