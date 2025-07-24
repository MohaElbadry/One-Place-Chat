#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPToolGenerator } from './generator/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx ts-node ToolGen-CLI.ts <openapi-spec.json> <output-directory> [openai-api-key]');
    process.exit(1);
  }

  const [specPath, outputDir, openaiApiKey] = args;
  
  // Get API key from environment or argument
  const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide it as an argument.');
    process.exit(1);
  }

  try {
    // Set OpenAI API key in environment
    process.env.OPENAI_API_KEY = apiKey;
    
    // Initialize the tool generator
    const generator = new MCPToolGenerator();
    
    // Generate the tools from the API spec file
    console.log('🚀 Starting tool generation...');
    const result = await generator.generateMCPTools(specPath);
    
    if (!result.tools || result.tools.length === 0) {
      throw new Error('No tools were generated from the API specification');
    }
    
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save each tool to a separate file
    for (const tool of result.tools) {
      const toolFileName = `${tool.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      const toolPath = path.join(outputDir, toolFileName);
      await fs.writeFile(toolPath, JSON.stringify(tool, null, 2));
      console.log(`📄 Generated tool: ${toolPath}`);
    }
    
    console.log('✅ Tool generation completed successfully!');
    console.log(`📁 Output directory: ${path.resolve(outputDir)}`);
    console.log(`✨ Generated ${result.tools.length} tools`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    process.exit(1);
  }
}

// Run the CLI
main().catch(console.error);
