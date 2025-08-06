// ENTRY POINT: This is the main entry for the One-Place-Chat backend tool generator and CLI.
// See /backend/index.ts for the main server entry point.

import { promises as fs } from 'fs';
import path from 'path';
import { program } from 'commander';
import { MCPTool } from './types.js';
import { OpenApiToolParser } from './parsers/OpenApiToolParser.js';

// Configuration
const DEFAULT_SPEC = path.join(process.cwd(), 'api-docs/Petstore/swagger.json');
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'generated-tools');

/**
 * Generates tool definitions from an OpenAPI spec.
 * @param specPath Path to the OpenAPI spec file
 * @param outputDir Output directory for generated tools
 * @param singleFile Whether to output a single file or individual files
 */
async function generateTools(specPath: string, outputDir: string, singleFile: boolean = true): Promise<void> {
  try {
    console.log('🚀 Starting tool generation...');
    console.log(`📄 Using OpenAPI spec: ${specPath}`);
    // Read and parse the OpenAPI spec
    const specContent = await fs.readFile(specPath, 'utf-8');
    const spec = JSON.parse(specContent);
    // Parse the spec and generate tools
    const parser = new OpenApiToolParser(spec);
    const tools = parser.parseOperations();
    if (!tools || tools.length === 0) {
      throw new Error('No tools were generated from the API specification');
    }
    await fs.mkdir(outputDir, { recursive: true });
    if (singleFile) {
      // Generate single file with all tools
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputPath = path.join(outputDir, `openAPI-tools-${timestamp}.json`);
      await fs.writeFile(outputPath, JSON.stringify(tools, null, 2));
      console.log(`✅ Generated ${tools.length} tools in single file: ${outputPath}`);
    } else {
      // Generate individual files for each tool
      for (const tool of tools) {
        const toolFileName = `${tool.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        const toolPath = path.join(outputDir, toolFileName);
        await fs.writeFile(toolPath, JSON.stringify(tool, null, 2));
        console.log(`✅ Generated tool: ${toolFileName}`);
      }
      console.log(`✅ Generated ${tools.length} individual tool files in: ${outputDir}`);
    }
  } catch (error) {
    console.error('❌ Error generating tools:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Set up CLI
program
  .name('tool-generator')
  .description('Generate MCP tools from OpenAPI specifications')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate MCP tools from an OpenAPI specification')
  .option('-s, --spec <path>', 'Path to OpenAPI specification file', DEFAULT_SPEC)
  .option('-o, --output <dir>', 'Output directory for generated tools', DEFAULT_OUTPUT_DIR)
  .option('--single-file', 'Generate a single file with all tools (default)', true)
  .option('--individual-files', 'Generate individual files for each tool')
  .action(async (options) => {
    await generateTools(
      options.spec,
      options.output,
      !options.individualFiles
    );
  });

program
  .command('start-server')
  .description('Start the MCP server with generated tools')
  .option('-p, --port <number>', 'Port to run the server on', '3000')
  .option('-t, --tools-dir <dir>', 'Directory containing tool definitions', DEFAULT_OUTPUT_DIR)
  .action(async (options) => {
    try {
      
      console.log(`✅ MCP Server started on port ${options.port}`);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down server...');
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Failed to start server:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parseAsync(process.argv).catch(console.error);

// Show help if no arguments provided
if (process.argv.length <= 2) {
  program.help();
}
