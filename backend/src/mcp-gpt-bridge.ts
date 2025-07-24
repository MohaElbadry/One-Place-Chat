#!/usr/bin/env node
import { MCPGPTBridge } from './bridge/MCPGPTBridge.js';
import { InteractiveCLI } from './cli/interactive-cli.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import type { ToolDefinition } from './types/openapi.types.js';
import type { MCPTool } from './bridge/MCPGPTBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🚀 MCP to GPT Bridge Starting...');
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    console.error('   Please set it in your .env file or environment');
    process.exit(1);
  }

  const bridge = new MCPGPTBridge();
  let cli: InteractiveCLI | null = null;

  // Handle cleanup on exit
  const cleanup = () => {
    console.log('\n🧹 Cleaning up...');
    if (cli) cli.cleanup();
    bridge.cleanup();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  try {
    // Start MCP server
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const specPath = path.resolve(process.argv[2] || path.join(__dirname, '../../test/specs/petstore.json'));
    // Use the generated-tools directory inside the backend directory
    const toolsDir = path.resolve(path.join(__dirname, '../generated-tools'));
    
    console.log(`📄 Using API spec: ${specPath}`);
    console.log(`🔧 Loading tools from: ${toolsDir}`);
    console.log(`🌐 Starting MCP server on port ${port}...`);
    
    // Ensure tools directory exists
    try {
      await fs.mkdir(toolsDir, { recursive: true });
    } catch (error) {
      console.error(`❌ Failed to create tools directory: ${toolsDir}`, error);
      throw error;
    }
    
    // Load all tool definitions
    const toolFiles = (await fs.readdir(toolsDir))
      .filter(file => file.endsWith('.json'));
    
    console.log(`🔍 Found ${toolFiles.length} tool files in ${toolsDir}`);
    
    const tools: MCPTool[] = [];
    for (const file of toolFiles) {
      try {
        const toolPath = path.join(toolsDir, file);
        const toolData = JSON.parse(await fs.readFile(toolPath, 'utf-8'));
        
        // Add path to inputSchema based on tool name
        if (toolData.name === 'uploadFile') {
          toolData.inputSchema.path = '/pet/{petId}/uploadImage';
        } else if (toolData.name === 'addPet' || toolData.name === 'updatePet') {
          toolData.inputSchema.path = '/pet';
        } else if (toolData.name.startsWith('get') || toolData.name.startsWith('delete')) {
          // For methods like getPetById, deletePet, etc.
          const resource = toolData.name.replace(/^(get|delete|update)/, '').toLowerCase();
          if (resource.includes('byid') || resource.includes('byname')) {
            toolData.inputSchema.path = `/${resource.replace(/by(id|name)$/, '')}/:id`;
          } else {
            toolData.inputSchema.path = `/${resource}`;
          }
        } else {
          // Default path based on tool name
          toolData.inputSchema.path = `/${toolData.name.replace(/([A-Z])/g, '/$1').toLowerCase()}`;
        }
        
        // Validate tool data
        if (toolData && toolData.name) {
          tools.push(toolData);
          console.log(`✅ Loaded tool: ${toolData.name} (${file})`);
        } else {
          console.warn(`⚠️ Skipping invalid tool in ${file}: missing required fields`);
        }
      } catch (error) {
        console.error(`❌ Failed to load tool from ${file}:`, error);
      }
    }
    
    // Register all tools at once
    if (tools.length > 0) {
      console.log(`🔄 Registering ${tools.length} tools...`);
      bridge.registerTools(tools);
      console.log(`✅ Successfully registered ${tools.length} tools`);
      
      // Verify tools were registered
      const registeredTools = bridge.getTools();
      console.log(`🔍 Bridge now has ${registeredTools.length} tools registered`);
    } else {
      console.warn('⚠️ No valid tools found in the tools directory');
    }
    
    await bridge.startMCPServer(port);
    
    // Start interactive CLI
    cli = new InteractiveCLI(bridge);
    await cli.start();
    
  } catch (error) {
    console.error('❌ Failed to start bridge:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    cleanup();
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default main;
