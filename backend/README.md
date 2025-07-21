# One Place Chat - Backend

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Backend service for One Place Chat application, featuring MCP (Machine-Readable API Client) tool generation from OpenAPI/Swagger specifications.

## Features

- 🚀 RESTful API for chat functionality
- 🔄 Real-time messaging with WebSocket support
- 📚 OpenAPI 3.0+ specification support
- 🛠️ MCP tool generation from API specs
- 🔒 JWT-based authentication
- 📦 Containerized with Docker

## Features

- 🚀 Generate MCP tools from OpenAPI/Swagger 2.0 and 3.x specifications
- 🛠️ Supports both local files and remote URLs
- 📦 Lightweight and dependency-free core
- 🔍 Automatic schema validation and type inference
- 🎯 Optimized for large API specifications
- 📝 Comprehensive TypeScript support

## Project Structure

The codebase is organized into a clean, modular structure for better maintainability:

```
src/utils/generator/
├── index.ts                 # Main exports and entry point
├── types/                   # TypeScript type definitions
│   ├── document.types.ts    # Document processing types
│   └── mcp-tool.types.ts    # MCP tool related types
├── loaders/                 # Document loading utilities
│   └── document-loader.ts   # Handles loading API specs from files/URLs
├── validators/              # Document validation
│   └── document-validator.ts # Validates OpenAPI/Swagger documents
├── chunkers/                # Document chunking for large specs
│   └── document-chunker.ts  # Splits large documents into chunks
├── processors/              # Endpoint processing
│   └── endpoint-processor.ts # Processes API endpoints
├── generators/              # Tool generation
│   └── tool-generator.ts    # Generates MCP tools from endpoints
└── optimizers/              # Tool optimization
    └── tool-optimizer.ts    # Optimizes and deduplicates tools
```

### Key Components

1. **Main Exports (`index.ts`)**
   - Primary interface for the MCP Tool Generator
   - Orchestrates the entire tool generation pipeline
   - Handles error handling and result formatting

2. **Type Definitions (`types/`)**
   - Strong TypeScript types for all interfaces
   - Clear separation of document and tool types
   - Self-documenting code with JSDoc comments

3. **Document Processing (`loaders/`, `validators/`, `chunkers/`)**
   - Load API specifications from various sources
   - Validate document structure and content
   - Efficiently process large documents by chunking

4. **Tool Generation (`processors/`, `generators/`, `optimizers/`)**
   - Extract and process API endpoints
   - Generate MCP tools with proper schemas
   - Optimize and deduplicate generated tools

## Prerequisites

- Node.js 20.x or later
- npm 9.x or later
- Docker (optional, for containerization)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/one-place-chat.git
   cd one-place-chat/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Using Docker
```bash
docker-compose up --build
```

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /api/generate-tools` - Generate MCP tools from OpenAPI spec
  - Body: `{ "filePath": "path/to/openapi.json" }`

## Development

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

#### With Custom Output Directory
```bash
mcp-tool-generator generate -i api-spec.json -o ./my-tools
```

#### Process Remote API Spec
```bash
mcp-tool-generator generate -i https://example.com/api-docs.json
```

## Programmatic Usage

```typescript
import { MCPToolGenerator } from 'mcp-tool-generator';

async function generateTools() {
  const generator = new MCPToolGenerator();
  const result = await generator.generateMCPTools('path/to/api-spec.json');
  
  console.log(`Generated ${result.tools.length} tools`);
  console.log('First tool:', result.tools[0]);
}

generateTools().catch(console.error);
```

## Output Format

The generator produces a JSON file with the following structure:

```typescript
{
  "tools": [
    {
      "name": "getUserById",
      "description": "Retrieves a user by ID",
      "inputSchema": {
        "type": "object",
        "properties": {
          "userId": { "type": "string" }
        },
        "required": ["userId"]
      },
      "annotations": {
        "title": "Get User by ID",
        "readOnlyHint": true,
        "destructiveHint": false,
        "idempotentHint": true,
        "openWorldHint": false
      }
    }
  ],
  "metadata": {
    "totalEndpoints": 1,
    "processedChunks": 1,
    "apiInfo": {
      "title": "Example API",
      "version": "1.0.0"
    },
    "processingTime": 123
  }
}
```

## Development

### Prerequisites
- Node.js 14+
- npm or yarn

### Building from Source
```bash
git clone https://github.com/your-username/mcp-tool-generator.git
cd mcp-tool-generator
npm install
npm run build
```

### Running Tests
```bash
npm test
```

## License

MIT © [Your Name]

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.
