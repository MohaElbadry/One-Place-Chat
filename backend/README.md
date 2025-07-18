# MCP Tool Generator

[![npm version](https://img.shields.io/npm/v/mcp-tool-generator.svg)](https://www.npmjs.com/package/mcp-tool-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful tool for generating Machine-Readable API Client (MCP) tools from OpenAPI/Swagger specifications. Convert your API documentation into executable tools with minimal configuration.

## Features

- 🚀 Generate MCP tools from OpenAPI/Swagger 2.0 and 3.x specifications
- 🛠️ Supports both local files and remote URLs
- 📦 Lightweight and dependency-free core
- 🔍 Automatic schema validation and type inference
- 🎯 Optimized for large API specifications
- 📝 Comprehensive TypeScript support

## Installation

### Global Installation
```bash
npm install -g mcp-tool-generator
```

### Local Installation
```bash
npm install --save-dev mcp-tool-generator
```

## Usage

### Command Line Interface
```bash
mcp-tool-generator generate -i <input-file> [options]
```

### Options
| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input <path>` | Path to OpenAPI/Swagger file (required) | - |
| `-o, --output <dir>` | Output directory for generated tools | `./generated-tools` |
| `--pretty` | Format output with indentation | `false` |
| `-v, --version` | Show version | - |
| `-h, --help` | Display help | - |

### Examples

#### Basic Usage
```bash
mcp-tool-generator generate -i api-spec.json
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
