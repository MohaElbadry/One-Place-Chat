# One-Place-Chat Backend

A sophisticated conversational AI system that enables natural language interactions with APIs. This backend provides intelligent tool matching, parameter extraction, and API execution through a conversational interface.

## 🏗️ Architecture Overview

The backend is built with a modular architecture consisting of several key components:

### Core Components

#### 1. **ConversationalEngine** (`src/core/ConversationalEngine.ts`)
- **Purpose**: Main orchestrator for natural language API interactions
- **Key Features**:
  - Processes natural language user input
  - Matches user intent to available API tools using semantic search
  - Extracts and validates parameters from user input
  - Executes API calls via cURL commands
  - Manages conversation state and context
  - Provides intelligent responses and clarifications

#### 2. **ConversationStore** (`src/core/ConversationStore.ts`)
- **Purpose**: Manages conversation persistence and state management
- **Key Features**:
  - Creates and manages conversation contexts
  - Stores and retrieves conversation messages
  - Persists conversations to disk for later retrieval
  - Manages conversation metadata and state
  - Extracts information from conversation history
  - Cleans up old conversations

#### 3. **LLMProvider** (`src/core/LLMProvider.ts`)
- **Purpose**: Multi-provider LLM client supporting OpenAI, Anthropic, and Ollama
- **Key Features**:
  - Unified interface for different LLM providers
  - Supports GPT-4, Claude-3, and Ollama models
  - Handles API key management and configuration
  - Provides consistent response formatting

### Tool Management

#### 4. **ToolSemanticMatcher** (`src/tools/ToolSemanticMatcher.ts`)
- **Purpose**: Semantic tool matcher using embeddings and keyword matching
- **Key Features**:
  - Uses embeddings for semantic similarity
  - Combines multiple scoring methods (semantic, keyword, intent, path)
  - Provides fallback to keyword matching
  - Extracts parameters from queries

#### 5. **ToolEmbeddingMatcher** (`src/tools/ToolEmbeddingMatcher.ts`)
- **Purpose**: Advanced tool matcher using embeddings for semantic similarity
- **Key Features**:
  - Embedding-based matching with caching
  - Performance optimization and metrics
  - Cache management and cleanup
  - Intent detection and scoring

#### 6. **CurlCommandExecutor** (`src/tools/CurlCommandExecutor.ts`)
- **Purpose**: Executes cURL commands and handles API tool execution
- **Key Features**:
  - Generates and executes cURL commands
  - Handles different HTTP methods (GET, POST, PUT, DELETE)
  - Manages headers and request bodies
  - Provides error handling and response parsing

#### 7. **ToolLoader** (`src/tools/ToolLoader.ts`)
- **Purpose**: Loads tool definitions from JSON files
- **Key Features**:
  - Loads tools from specified directory
  - Provides tool search and filtering
  - Handles both single tools and arrays of tools
  - Caches loaded tools for performance

### Configuration & Types

#### 8. **LLMConfig** (`src/config/llm-config.ts`)
- **Purpose**: Configuration management for LLM providers
- **Key Features**:
  - Defines supported models and providers
  - Manages API keys from environment variables
  - Provides model selection utilities

#### 9. **Types** (`src/types.ts`)
- **Purpose**: TypeScript type definitions for the entire system
- **Key Features**:
  - MCPTool interface for API tools
  - Conversation and message types
  - LLM response and matching types
  - OpenAPI integration types

### Parsers & CLI

#### 10. **OpenApiToolParser** (`src/parsers/OpenApiToolParser.ts`)
- **Purpose**: Parser for OpenAPI specifications that generates MCP tools
- **Key Features**:
  - Converts OpenAPI operations into executable tool definitions
  - Handles parameter extraction and schema resolution
  - Supports both OpenAPI 2.0 and 3.x specifications
  - Generates proper input schemas for tools

#### 11. **ChatInterface** (`src/cli/ChatInterface.ts`)
- **Purpose**: Interactive CLI chat interface for the conversational engine
- **Key Features**:
  - User-friendly command-line interface
  - Model selection and conversation management
  - Real-time chat with the AI system
  - Conversation history and resumption

#### 12. **McpTestingCli** (`src/cli/McpTestingCli.ts`)
- **Purpose**: Testing and development CLI for MCP tools
- **Key Features**:
  - Tool listing and searching
  - cURL command generation
  - API execution testing
  - OpenAI integration for enhanced generation

## 🔄 Workflow Overview

### 1. **Tool Generation Phase**
```
OpenAPI Spec → OpenApiToolParser → MCPTool Definitions → JSON Files
```

1. **Input**: OpenAPI specification files (Swagger/OpenAPI 3.x)
2. **Processing**: `OpenApiToolParser` converts operations to `MCPTool` objects
3. **Output**: JSON files in `generated-tools/` directory

### 2. **Initialization Phase**
```
ToolLoader → ToolSemanticMatcher → ConversationalEngine → LLMProvider
```

1. **Tool Loading**: `ToolLoader` reads JSON files and creates tool objects
2. **Embedding Generation**: `ToolSemanticMatcher` creates embeddings for semantic search
3. **Engine Setup**: `ConversationalEngine` initializes with tools and LLM provider
4. **Model Selection**: User selects preferred LLM model (GPT-4, Claude-3, etc.)

### 3. **Conversation Flow**
```
User Input → Tool Matching → Parameter Extraction → Validation → Execution → Response
```

#### Step 1: **User Input Processing**
- User provides natural language request
- `ConversationalEngine.processMessage()` receives input
- Conversation state is updated with timestamp

#### Step 2: **Tool Matching**
- `ToolSemanticMatcher.findBestMatch()` analyzes user input
- Combines semantic similarity, keyword matching, and intent detection
- Returns best matching tool with confidence score
- If confidence < threshold (0.6), requests clarification

#### Step 3: **Parameter Extraction**
- `extractParametersFromInput()` uses LLM to extract parameters
- Maps natural language to exact schema field names
- Validates parameter types and formats
- Filters out irrelevant words and placeholder values

#### Step 4: **Requirement Analysis**
- `analyzeToolRequirements()` checks required vs optional fields
- Identifies missing required parameters
- Suggests useful optional parameters
- Handles path parameters for GET requests

#### Step 5: **Clarification or Execution**
- **If missing required fields**: Creates clarification request
- **If all required fields present**: Proceeds to execution
- **If optional fields suggested**: Offers to add them

#### Step 6: **API Execution**
- `generateCurlCommand()` creates proper cURL command
- `CurlCommandExecutor.executeCurl()` runs the command
- Response is parsed and formatted
- Success/error messages are generated

#### Step 7: **Response Generation**
- Formatted response with cURL command and results
- Conversation state is reset for next interaction
- Message is stored in conversation history

### 4. **Persistence & State Management**
```
ConversationStore → JSON Files → Conversation Context → Message History
```

- Each conversation has unique ID and persistent storage
- Messages and metadata are saved to disk
- Conversation state tracks current tool and parameters
- Automatic cleanup removes old conversations

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key (optional, for enhanced features)

### Installation
```bash
cd backend
npm install
```

### Environment Setup
Create a `.env` file:
```env
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

### Usage

#### 1. Generate Tools from OpenAPI Spec
```bash
npm run generate-tools
# or
node src/index.ts generate --spec api-docs/Petstore/swagger.json
```

#### 2. Start Interactive Chat
```bash
npm run chat
# or
node src/cli/ChatInterface.ts
```

#### 3. Test MCP Tools
```bash
node src/cli/McpTestingCli.ts
```

## 📁 File Structure

```
backend/
├── src/
│   ├── core/                    # Core engine components
│   │   ├── ConversationalEngine.ts
│   │   ├── ConversationStore.ts
│   │   └── LLMProvider.ts
│   ├── tools/                   # Tool management
│   │   ├── ToolSemanticMatcher.ts
│   │   ├── ToolEmbeddingMatcher.ts
│   │   ├── CurlCommandExecutor.ts
│   │   └── ToolLoader.ts
│   ├── config/                  # Configuration
│   │   └── llm-config.ts
│   ├── parsers/                 # Input parsing
│   │   └── OpenApiToolParser.ts
│   ├── cli/                     # Command-line interfaces
│   │   ├── ChatInterface.ts
│   │   └── McpTestingCli.ts
│   ├── types.ts                 # Type definitions
│   ├── index.ts                 # Main entry point
│   └── server-autogen.ts        # MCP server
├── generated-tools/             # Generated tool definitions
├── conversations/               # Conversation storage
├── api-docs/                   # OpenAPI specifications
└── package.json
```

## 🔧 Configuration

### Supported LLM Models
- **OpenAI**: GPT-4, GPT-4 Turbo
- **Anthropic**: Claude-3 Sonnet, Claude-3 Opus
- **Ollama**: o3 (local models)

### Tool Generation Options
- Single file output (default)
- Individual files per tool
- Custom output directories
- Multiple OpenAPI specs

## 🧪 Testing

### Tool Testing
```bash
# Test specific tool
node src/cli/McpTestingCli.ts
# Select "Generate cURL" and choose a tool
```

### Conversation Testing
```bash
# Start interactive chat
npm run chat
# Try natural language requests like:
# "Get a pet with ID 5"
# "Create a new pet named Fluffy"
# "Find pets with status available"
```

## 🔍 Debugging

### Enable Debug Logging
```bash
DEBUG=* npm run chat
```

### Check Tool Loading
```bash
# Verify tools are loaded correctly
node -e "const { ToolLoader } = require('./dist/tools/ToolLoader.js'); new ToolLoader().loadTools('./generated-tools').then(tools => console.log('Loaded', tools.length, 'tools'));"
```

### Monitor Conversation State
- Check `conversations/` directory for saved conversations
- Review conversation JSON files for debugging
- Monitor console output for tool matching confidence scores

## 🚨 Error Handling

### Common Issues
1. **Tool Not Found**: Check if OpenAPI spec is valid and tools are generated
2. **Parameter Extraction Failed**: Verify LLM API key is set correctly
3. **API Execution Error**: Check if target API is accessible and parameters are correct
4. **Embedding Generation Failed**: Ensure OpenAI API key is available

### Troubleshooting
- Check environment variables are set correctly
- Verify generated tools exist in `generated-tools/` directory
- Ensure target APIs are accessible from your network
- Review conversation logs for detailed error messages

## 🔄 Development Workflow

1. **Add New API**: Place OpenAPI spec in `api-docs/`
2. **Generate Tools**: Run tool generation command
3. **Test Tools**: Use CLI to test new tools
4. **Update Engine**: Modify `ConversationalEngine` if needed
5. **Test Conversations**: Use chat interface to test natural language

## 📈 Performance Considerations

- **Embedding Caching**: Tool embeddings are cached for performance
- **Conversation Cleanup**: Old conversations are automatically removed
- **Memory Management**: Conversation states are cleaned up after timeout
- **API Rate Limiting**: Built-in delays and retry logic for API calls

## 🔐 Security

- API keys are loaded from environment variables
- No sensitive data is logged or stored in plain text
- Conversation data is stored locally in JSON format
- cURL commands are sanitized before execution

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
