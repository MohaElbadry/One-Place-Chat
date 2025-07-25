#!/usr/bin/env node
import 'dotenv/config';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import OpenAI from 'openai';

// Types
interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  annotations?: {
    method?: string;
    path?: string;
    title?: string;
  };
  endpoint?: {
    method: string;
    path: string;
    baseUrl: string;
  };
}

interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

// Enhanced Logger
const logger = {
  info: (msg: string) => console.log(chalk.blue(`ℹ️  ${msg}`)),
  success: (msg: string) => console.log(chalk.green(`✅ ${msg}`)),
  error: (msg: string) => console.error(chalk.red(`❌ ${msg}`)),
  warning: (msg: string) => console.warn(chalk.yellow(`⚠️  ${msg}`)),
  log: (msg: string) => console.log(msg),
  title: (msg: string) => console.log(chalk.bold.cyan(`\n🎯 ${msg}\n${'='.repeat(msg.length + 4)}`)),
  section: (msg: string) => console.log(chalk.bold(`\n📋 ${msg}\n${'-'.repeat(msg.length + 4)}`)),
  curl: (cmd: string) => {
    console.log(chalk.gray('\n```bash'));
    console.log(chalk.white(cmd));
    console.log(chalk.gray('```\n'));
  }
};

class MCPCurlGenerator {
  private openai: OpenAI | null = null;
  private tools: MCPTool[] = [];
  private mcpServer: ChildProcess | null = null;
  private messageId = 1;
  private isServerReady = false;

  constructor() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        logger.warning('OPENAI_API_KEY environment variable not set. OpenAI features will be disabled.');
      } else {
        this.openai = new OpenAI({ 
          apiKey,
          timeout: 30000, // 30 seconds timeout
          maxRetries: 2
        });
        logger.info('OpenAI client initialized successfully');
      }
    } catch (error) {
      logger.error(`Failed to initialize OpenAI client: ${error instanceof Error ? error.message : String(error)}`);
      this.openai = null;
    }
  }

  async initialize(): Promise<void> {
    logger.title('MCP cURL Generator with OpenAI');
    
    // Choose data source
    const { dataSource } = await inquirer.prompt([{
      type: 'list',
      name: 'dataSource',
      message: 'How would you like to load your tools?',
      choices: [
        { name: '🔗 Connect to MCP Server (Live)', value: 'server' },
        { name: '📁 Load from JSON files', value: 'files' },
        { name: '🚪 Exit', value: 'exit' }
      ]
    }]);

    if (dataSource === 'exit') {
      logger.success('Goodbye! 👋');
      process.exit(0);
    }

    if (dataSource === 'server') {
      await this.connectToMCPServer();
    } else {
      await this.loadToolsFromFiles();
    }
  }

  private async connectToMCPServer(): Promise<void> {
    const { serverPath } = await inquirer.prompt([{
      type: 'input',
      name: 'serverPath',
      message: 'Enter path to your MCP server:',
      default: 'dist/main.js'
    }]);

    const { apiSpec } = await inquirer.prompt([{
      type: 'input',
      name: 'apiSpec',
      message: 'Enter path to your API spec:',
      default: 'api-docs/Petstore/swagger.json'
    }]);

    try {
      logger.info('Starting MCP server...');
      
      this.mcpServer = spawn('node', [serverPath, apiSpec], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.mcpServer.on('error', (error) => {
        logger.error(`Failed to start MCP server: ${error.message}`);
        throw error;
      });

      this.mcpServer.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          logger.info(`Server: ${message}`);
        }
      });

      // Initialize MCP server
      await this.sendMCPMessage({
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "mcp-curl-generator", version: "1.0.0" }
        }
      });

      this.isServerReady = true;
      await this.loadToolsFromServer();
      logger.success(`Connected to MCP server with ${this.tools.length} tools`);
    } catch (error) {
      logger.error(`Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  private async loadToolsFromServer(): Promise<void> {
    try {
      const result = await this.sendMCPMessage({
        method: "tools/list"
      });
      
      this.tools = result.tools || [];
    } catch (error) {
      logger.error(`Failed to load tools from server: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async sendMCPMessage(message: any): Promise<any> {
    if (!this.mcpServer || (!this.isServerReady && message.method !== 'initialize')) {
      throw new Error('MCP server not ready');
    }

    return new Promise((resolve, reject) => {
      message.jsonrpc = "2.0";
      message.id = this.messageId++;
      
      const messageStr = JSON.stringify(message) + '\n';
      
      const timeout = setTimeout(() => {
        reject(new Error('MCP request timeout (10s)'));
      }, 10000);

      const handler = (data: Buffer) => {
        try {
          const lines = data.toString().split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const response = JSON.parse(line);
              if (response.id === message.id) {
                clearTimeout(timeout);
                this.mcpServer?.stdout?.off('data', handler);
                
                if (response.error) {
                  reject(new Error(`MCP Error: ${response.error.message}`));
                } else {
                  resolve(response.result || response);
                }
                return;
              }
            } catch (parseError) {
              // Continue to next line
            }
          }
        } catch (error) {
          // Continue listening
        }
      };

      this.mcpServer?.stdout?.on('data', handler);
      this.mcpServer?.stdin?.write(messageStr);
    });
  }

  private async loadToolsFromFiles(): Promise<void> {
    const { toolsDir } = await inquirer.prompt([{
      type: 'input',
      name: 'toolsDir',
      message: 'Enter path to tools directory:',
      default: './generated-tools'
    }]);

    try {
      const files = (await fs.readdir(toolsDir)).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const content = await fs.readFile(path.join(toolsDir, file), 'utf-8');
          const toolData = JSON.parse(content);
          
          // Handle both single tools and arrays of tools
          if (Array.isArray(toolData)) {
            this.tools.push(...toolData);
          } else {
            this.tools.push(toolData);
          }
        } catch (error) {
          logger.warning(`Skipping invalid tool file: ${file}`);
        }
      }
      
      logger.success(`Loaded ${this.tools.length} tools from ${files.length} files`);
    } catch (error) {
      logger.error(`Failed to load tools: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  async start(): Promise<void> {
    if (this.tools.length === 0) {
      logger.error('No tools loaded. Please check your configuration.');
      return;
    }

    while (true) {
      try {
        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📋 List all tools', value: 'list' },
            { name: '🔍 Search tools', value: 'search' },
            { name: '🔧 Generate cURL', value: 'generate' },
            { name: '🚪 Exit', value: 'exit' }
          ]
        }]);

        switch (action) {
          case 'list':
            await this.listTools();
            break;
          case 'search':
            await this.searchTools();
            break;
          case 'generate':
            await this.generateCurlWorkflow();
            break;
          case 'exit':
            logger.success('Goodbye! 👋');
            this.cleanup();
            process.exit(0);
        }
      } catch (error) {
        logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async listTools(): Promise<void> {
    logger.section('Available Tools');
    
    this.tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${chalk.bold(tool.name)}`);
      console.log(`   📝 ${tool.description || 'No description'}`);
      
      const method = tool.annotations?.method || tool.endpoint?.method || 'GET';
      const path = tool.annotations?.path || tool.endpoint?.path || '';
      console.log(`   🌐 ${method} ${path}`);
      
      if (tool.inputSchema?.properties) {
        const params = Object.keys(tool.inputSchema.properties)
          .filter(key => !key.startsWith('_'))
          .join(', ');
        console.log(`   📊 Parameters: ${params || 'none'}`);
      }
      console.log('');
    });

    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }

  private async searchTools(): Promise<void> {
    const { query } = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'Search for tools (name or description):',
      validate: (input: string) => input.trim().length > 0 || 'Please enter a search term'
    }]);

    const results = this.tools.filter(tool => 
      tool.name.toLowerCase().includes(query.toLowerCase()) || 
      (tool.description && tool.description.toLowerCase().includes(query.toLowerCase()))
    );

    if (results.length === 0) {
      logger.warning('No tools found matching your search.');
      return;
    }

    logger.success(`Found ${results.length} matching tools:`);
    results.forEach((tool, index) => {
      console.log(`${index + 1}. ${chalk.bold(tool.name)} - ${tool.description || ''}`);
    });
  }

  private async generateCurlWorkflow(): Promise<void> {
    const choices = this.tools.map((tool, index) => ({
      name: `${tool.name} - ${tool.description || 'No description'}`,
      value: index
    }));

    const { toolIndex } = await inquirer.prompt([{
      type: 'list',
      name: 'toolIndex',
      message: 'Select a tool to generate cURL for:',
      choices,
      pageSize: 15
    }]);

    const tool = this.tools[toolIndex];
    await this.generateToolCurl(tool);
  }

  private async generateToolCurl(tool: MCPTool): Promise<void> {
    logger.title(`Generate cURL: ${tool.name}`);
    logger.log(`📝 Description: ${tool.description || 'No description'}`);
    
    const method = tool.annotations?.method || tool.endpoint?.method || 'GET';
    const path = tool.annotations?.path || tool.endpoint?.path || '';
    logger.log(`🌐 Endpoint: ${method} ${path}`);

    // Collect parameters
    const parameters: Record<string, any> = {};
    
    if (tool.inputSchema?.properties) {
      logger.section('Parameter Input');
      
      for (const [paramName, paramDef] of Object.entries(tool.inputSchema.properties as Record<string, any>)) {
        if (paramName.startsWith('_')) continue; // Skip internal params
        
        const isRequired = tool.inputSchema.required?.includes(paramName);
        const description = paramDef.description || '';
        const paramType = paramDef.type || 'string';
        
        const { value } = await inquirer.prompt([{
          type: 'input',
          name: 'value',
          message: `${paramName} (${paramType})${isRequired ? ' *required*' : ''}: ${description}`,
          validate: (input: string) => {
            if (isRequired && !input.trim()) {
              return 'This field is required';
            }
            return true;
          }
        }]);
        
        if (value.trim()) {
          // Try to parse JSON for complex types
          try {
            if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
              parameters[paramName] = JSON.parse(value.trim());
            } else if (paramType === 'number') {
              parameters[paramName] = Number(value.trim());
            } else if (paramType === 'boolean') {
              parameters[paramName] = value.trim().toLowerCase() === 'true';
            } else {
              parameters[paramName] = value.trim();
            }
          } catch {
            parameters[paramName] = value.trim();
          }
        }
      }
    }

    // Generate cURL
    try {
      let curlCommand: string;

      // First try OpenAI if available
      if (this.openai) {
        try {
          logger.info('Generating cURL with OpenAI...');
          curlCommand = await this.generateCurlWithOpenAI(tool, parameters);
        } catch (error) {
          logger.warning('Falling back to basic cURL generation');
          curlCommand = this.generateBasicCurl(tool, parameters);
        }
      } else if (this.isServerReady) {
        // Fall back to MCP server if OpenAI is not available
        logger.info('Generating cURL via MCP server...');
        curlCommand = await this.generateCurlViaMCP(tool.name, parameters);
      } else {
        // Last resort: basic cURL generation
        logger.info('Generating basic cURL command...');
        curlCommand = this.generateBasicCurl(tool, parameters);
      }

      logger.success('✅ Generated cURL Command:');
      logger.curl(curlCommand);

      // Ask if they want to generate another or go back
      const { nextAction } = await inquirer.prompt([{
        type: 'list',
        name: 'nextAction',
        message: 'What would you like to do next?',
        choices: [
          { name: '🔄 Generate another cURL', value: 'another' },
          { name: '⬅️  Back to main menu', value: 'back' }
        ]
      }]);

      if (nextAction === 'another') {
        await this.generateCurlWorkflow();
      }

    } catch (error) {
      logger.error(`Failed to generate cURL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateCurlViaMCP(toolName: string, parameters: Record<string, any>): Promise<string> {
    try {
      const result: MCPResponse = await this.sendMCPMessage({
        method: "tools/call",
        params: {
          name: toolName,
          arguments: {
            ...parameters,
            _generateCurlOnly: true
          }
        }
      });

      if (result.isError) {
        throw new Error(`MCP Error: ${result.content[0]?.text}`);
      }

      const curlText = result.content[0]?.text || '';
      
      // Extract cURL command from MCP response
      const curlMatch = curlText.match(/```bash\n(curl[^`]+)\n```/);
      if (curlMatch) {
        return curlMatch[1].trim();
      }

      // Try to find curl command directly
      const lines = curlText.split('\n');
      const curlLine = lines.find(line => line.trim().startsWith('curl'));
      if (curlLine) {
        return curlLine.trim();
      }

      return curlText;
    } catch (error) {
      throw new Error(`MCP cURL generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateCurlWithOpenAI(tool: MCPTool, parameters: Record<string, any>): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const prompt = `Generate a cURL command for the following API endpoint:

Tool Name: ${tool.name}
Description: ${tool.description || 'No description'}
Method: ${tool.annotations?.method || tool.endpoint?.method || 'GET'}
Path: ${tool.annotations?.path || tool.endpoint?.path || ''}
Base URL: ${tool.endpoint?.baseUrl || 'https://api.example.com'}

Parameters:
${JSON.stringify(parameters, null, 2)}

Please provide a complete cURL command that makes this API request. Include all necessary headers and authentication if required.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4', // or 'gpt-3.5-turbo' for faster/cheaper responses
        messages: [
          { role: 'system', content: 'You are an API expert that generates accurate cURL commands. Always return just the raw cURL command without any additional text or code blocks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const curlCommand = response.choices[0]?.message?.content?.trim();
      if (!curlCommand) {
        throw new Error('No cURL command was generated');
      }

      // Clean up the response to ensure it's a valid cURL command
      return curlCommand.replace(/^```(?:bash|sh)?\n?|```$/g, '').trim();
    } catch (error) {
      logger.error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to generate cURL with OpenAI');
    }
  }

  private generateBasicCurl(tool: MCPTool, parameters: Record<string, any>): string {
    const method = tool.annotations?.method || tool.endpoint?.method || 'GET';
    let path = tool.annotations?.path || tool.endpoint?.path || '/';
    const baseUrl = tool.endpoint?.baseUrl || 'https://api.example.com';

    // Replace path parameters
    for (const [key, value] of Object.entries(parameters)) {
      if (path.includes(`{${key}}`)) {
        path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
      }
    }

    // Build query string for GET or other query params
    const queryParams = new URLSearchParams();
    const bodyParams: Record<string, any> = {};

    Object.entries(parameters).forEach(([key, value]) => {
      if (!path.includes(`{${key}}`) && value !== undefined && value !== '') {
        if (method === 'GET' || method === 'DELETE') {
          queryParams.append(key, String(value));
        } else {
          bodyParams[key] = value;
        }
      }
    });

    const queryString = queryParams.toString();
    const url = `${baseUrl}${path}${queryString ? '?' + queryString : ''}`;

    let curl = `curl -X ${method} '${url}'`;

    // Add headers
    curl += ` \\\n  -H 'Accept: application/json'`;
    
    // Add body for non-GET requests
    if (method !== 'GET' && method !== 'HEAD' && Object.keys(bodyParams).length > 0) {
      curl += ` \\\n  -H 'Content-Type: application/json'`;
      curl += ` \\\n  -d '${JSON.stringify(bodyParams, null, 2)}'`;
    }

    return curl;
  }

  cleanup(): void {
    if (this.mcpServer) {
      logger.info('Shutting down MCP server...');
      this.mcpServer.kill();
      this.mcpServer = null;
    }
  }
}

// Main execution
async function main() {
  const cli = new MCPCurlGenerator();

  // Handle cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n\n👋 Interrupted. Cleaning up...');
    cli.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cli.cleanup();
    process.exit(0);
  });

  try {
    await cli.initialize();
    await cli.start();
  } catch (error) {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    cli.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { MCPCurlGenerator };