#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ToolLoader } from './tools/ToolLoader.js';
import { ToolSemanticMatcher } from './tools/ToolSemanticMatcher.js';
import { CurlCommandExecutor } from './tools/CurlCommandExecutor.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Auto-generated MCP server for API tool execution.
 * Provides tool listing and execution capabilities.
 */
class MCPAutoGenAPIServer {
  private server: Server;
  private toolLoader: ToolLoader;
  private toolMatcher: ToolSemanticMatcher;
  private curlExecutor: CurlCommandExecutor;

  constructor() {
    this.server = new Server(
      { name: 'mcp-autogen-api-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.toolLoader = new ToolLoader();
    this.toolMatcher = new ToolSemanticMatcher();
    this.curlExecutor = new CurlCommandExecutor();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.toolLoader.getTools();
      return {
        tools: tools.slice(0, 50).map(tool => ({
          name: tool.name,
          description: tool.description || `${tool.endpoint.method} ${tool.endpoint.path}`,
          inputSchema: tool.inputSchema || { type: 'object', properties: {} }
        }))
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (name === 'smart_api_execute' && args && typeof args.request === 'string') {
        return this.handleSmartExecution(args.request as string);
      }

      const tool = this.toolLoader.getTool(name);
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Tool "${name}" not found.` }],
          isError: true
        };
      }

      return this.executeTool(tool, args || {});
    });
  }

  private async handleSmartExecution(request: string) {
    try {
      const tools = this.toolLoader.getTools();
      const matchResult = await this.toolMatcher.findBestMatch(request, tools);
      
      if (!matchResult) {
        return {
          content: [{
            type: 'text',
            text: `Couldn't find a matching API endpoint for: "${request}"`
          }]
        };
      }

      return this.executeTool(matchResult.tool, matchResult.parameters);
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  private async executeTool(tool: any, parameters: Record<string, any>) {
    try {
      const result = await this.curlExecutor.execute(tool, parameters);
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }
      return {
        content: [{
          type: 'text',
          text: `Response: ${JSON.stringify(result.body, null, 2)}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to execute tool: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async start(toolsDir: string = './generated-tools') {
    console.log(`Loading tools from: ${toolsDir}`);
    await this.toolLoader.loadTools(toolsDir);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('✅ MCP Auto-Generated API Server started');
    console.log('Use "smart_api_execute" for natural language requests');
  }
}

// Start server
const server = new MCPAutoGenAPIServer();
server.start(process.argv[2]).catch(console.error);
