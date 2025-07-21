#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { ToolGenerator } = require('./ToolGenerator');

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
    // Read and parse the OpenAPI spec
    const specContent = await fs.readFile(specPath, 'utf-8');
    const apiSpec = JSON.parse(specContent);

    // Initialize the generator
    const generator = new ToolGenerator(apiKey);
    
    // Generate the tool implementations
    console.log('🚀 Starting tool generation...');
    await generator.generateToolImplementations(apiSpec, outputDir);
    
    console.log('✅ Tool generation completed successfully!');
    console.log(`📁 Output directory: ${path.resolve(outputDir)}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main();
}
