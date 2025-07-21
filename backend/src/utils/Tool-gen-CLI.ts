#!/usr/bin/env node

/**
 * MCP Tool Generator CLI
 * 
 * This script provides a command-line interface for generating MCP (Machine-Readable API Client) Tools
 * from OpenAPI/Swagger specifications. It processes API documentation files and generates executable
 * tool definitions that can be used to interact with the API.
 * 
 * Usage:
 *   mcp-tool-generator generate -i <input-file> [-o <output-dir>]
 * 
 * Example:
 *   mcp-tool-generator generate -i ./api-spec.json -o ./generated-tools
 */

import { MCPToolGenerator } from './generator';
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';

// Initialize the command-line interface
const program = new Command();

// Configure the main program
program
  .name('mcp-tool-generator')
  .description('Generate MCP (Machine-Readable API Client) Tools from OpenAPI/Swagger specifications')
  .version('1.0.0', '-v, --version', 'Show version information')
  .helpOption('-h, --help', 'Display help for command');

/**
 * Generate MCP tools from an API specification
 */
program
  .command('generate')
  .description('Generate MCP tools from an API specification')
  .requiredOption(
    '-i, --input <path>', 
    'Path to OpenAPI/Swagger file (local path or URL)'
  )
  .option(
    '-o, --output <path>', 
    'Output directory for generated tools', 
    './generated-tools'
  )
  .option(
    '--pretty', 
    'Format the output JSON with indentation for better readability'
  )
  .action(generateTools);

/**
 * Generate MCP tools from the specified API specification
 * @param options Command-line options
 */
async function generateTools(options: { 
  input: string; 
  output: string;
  pretty?: boolean;
}) {
  try {
    console.log('🚀 Starting MCP Tool Generator...');
    
    // Validate input file
    if (!options.input.startsWith('http') && !fs.existsSync(options.input)) {
      throw new Error(`Input file not found: ${options.input}`);
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
      console.log(`📁 Created output directory: ${path.resolve(options.output)}`);
    }
    
    // Initialize the MCP Tool Generator with custom options
    const generator = new MCPToolGenerator({
      maxChunkSize: 10000,  // Process large files in 10KB chunks
      chunkOverlap: 500     // 500 bytes overlap between chunks
    });
    
    console.log(`🔍 Processing API document: ${options.input}`);
    
    // Generate MCP tools from the API documentation
    const result = await generator.generateMCPTools(options.input);
    
    // Prepare the output file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(options.output, `mcp-tools-${timestamp}.json`);
    
    // Save the generated tools to a file
    const jsonString = options.pretty 
      ? JSON.stringify(result, null, 2) 
      : JSON.stringify(result);
    
    fs.writeFileSync(outputFile, jsonString);
    
    // Print summary
    console.log('\n✅ MCP Tools generated successfully!');
    console.log('='.repeat(50));
    console.log(`📊 Tools generated: ${result.tools.length}`);
    console.log(`📝 Processed endpoints: ${result.metadata.totalEndpoints}`);
    console.log(`⏱️  Processing time: ${result.metadata.processingTime}ms`);
    console.log(`💾 Output saved to: ${path.resolve(outputFile)}`);
    
    // Show an example tool if available
    if (result.tools.length > 0) {
      const exampleTool = result.tools[0];
      console.log('\n🔧 Example MCP Tool:');
      console.log('='.repeat(50));
      console.log(`Name: ${exampleTool.name}`);
      console.log(`Description: ${exampleTool.description || 'N/A'}`);
      console.log(`Input Parameters: ${Object.keys(exampleTool.inputSchema.properties || {}).length}`);
      
      if (options.pretty) {
        console.log('\n📋 Tool Definition:');
        console.log('='.repeat(50));
        console.log(JSON.stringify(exampleTool, null, 2));
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:');
    console.error('='.repeat(50));
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\n💡 Tip: Use --help for usage information');
    process.exit(1);
  }
}

// Handle command-line arguments
if (process.argv.length <= 2) {
  // Show help if no arguments provided
  program.help();
} else {
  // Parse and execute the command
  program.parse(process.argv);
}

// Export for testing purposes
export { generateTools };
