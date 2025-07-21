import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenAPIParser } from '../utils/OpenAPIParser.js';
import type { OpenAPISpec } from '../types/openapi.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    // Load the Swagger Petstore spec
    const specPath = path.join(__dirname, '../../api-docs/Petstore/swagger.json');
    const specContent = await fs.readFile(specPath, 'utf-8');
    const spec = JSON.parse(specContent) as OpenAPISpec;

    // Parse the OpenAPI spec
    const parser = new OpenAPIParser(spec);
    const tools = parser.parseOperations();

    // Output the first few tools as examples
    console.log(`Successfully parsed ${tools.length} operations`);
    console.log('\nExample tools:');
    
    for (let i = 0; i < Math.min(3, tools.length); i++) {
      console.log(`\nTool ${i + 1}: ${tools[i].name}`);
      console.log('Description:', tools[i].description);
      console.log('Endpoint:', `${tools[i].endpoint.method} ${tools[i].endpoint.baseUrl}${tools[i].endpoint.path}`);
      console.log('Input Schema:', JSON.stringify(tools[i].inputSchema, null, 2));
      console.log('Security:', JSON.stringify(tools[i].security, null, 2));
      console.log('---');
    }

    // Save all tools to a file for inspection
    const outputPath = path.join(__dirname, 'parsed-tools.json');
    await fs.writeFile(outputPath, JSON.stringify(tools, null, 2));
    console.log(`\nAll tools saved to: ${outputPath}`);

  } catch (error) {
    console.error('Error parsing OpenAPI spec:', error);
    process.exit(1);
  }
}

main();
