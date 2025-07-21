# API Tool Generator

This tool generates TypeScript implementations for API tools based on OpenAPI specifications.

## Installation

1. Install the required dependencies:
   ```bash
   npm install openai axios zod
   ```

2. Set your OpenAI API key as an environment variable:
   ```bash
   export OPENAI_API_KEY='your-api-key-here'
   ```
   
   Or provide it as a command-line argument.

## Usage

### Basic Usage

```bash
npx ts-node src/utils/ToolGen-CLI.ts path/to/openapi-spec.json output/directory/
```

### With explicit API key

```bash
npx ts-node src/utils/ToolGen-CLI.ts path/to/openapi-spec.json output/directory/ your-openai-api-key
```

## How It Works

1. The tool reads an OpenAPI specification file.
2. It extracts all API endpoints and generates tool definitions.
3. For each tool, it uses OpenAI to generate a TypeScript implementation.
4. The implementations are saved to the specified output directory.

## Output

The tool generates a TypeScript file containing implementations for all the API endpoints found in the OpenAPI spec. Each implementation includes:

- Function documentation
- Input parameter validation
- API request handling
- Error handling
- TypeScript types

## Example

For an OpenAPI spec with a `GET /users/{id}` endpoint, the tool will generate a function like:

```typescript
/**
 * Get user by ID
 * Endpoint: GET /users/{id}
 */
async function getUserById(params: { id: string }): Promise<any> {
  try {
    const response = await axios.get(`${BASE_URL}/users/${params.id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user:', error.message);
    throw error;
  }
}
```

## Requirements

- Node.js 14+
- OpenAI API key
- OpenAPI 3.0+ specification file

## License

MIT
