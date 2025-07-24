import OpenAI from "openai";
import * as http from 'http';
import * as readline from "readline";
import * as dotenv from "dotenv";

dotenv.config();

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    path?: string; // API endpoint path
  };
}

interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export class MCPGPTBridge {
  private openai: OpenAI;
  private server: http.Server | null = null;
  private tools: MCPTool[] = [];
  private messageId = 1;
  private isServerReady = false;

  constructor(openaiApiKey?: string) {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAI API key is required. Set OPENAI_API_KEY environment variable."
      );
    }
    this.openai = new OpenAI({ apiKey });
  }

  async startMCPServer(port: number = 3000): Promise<void> {
    console.log('🚀 Starting MCP HTTP server...');
    
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        let body = '';
        
        if (req.method === 'POST' && req.url === '/mcp') {
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', () => {
            try {
              const message = JSON.parse(body);
              console.log('🔧 MCP Server: Received message:', message.method || 'unknown');
              
              // Handle different message types
              if (message.method === 'initialize') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id: message.id,
                  result: {}
                }));
                return;
              }
              
              // Handle tools/call method
              if (message.method === 'tools/call') {
                const toolName = message.params?.name;
                const args = message.params?.arguments || {};
                const generateCurlOnly = args._generateCurlOnly;
                
                // Remove internal parameters
                const { _generateCurlOnly, ...cleanArgs } = args;
                
                // Find the tool
                const tool = this.tools.find(t => t.name === toolName);
                
                if (!tool) {
                  res.writeHead(404, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id: message.id,
                    error: { code: -32601, message: `Tool not found: ${toolName}` }
                  }));
                  return;
                }
                
                try {
                  // For file uploads, we need to handle multipart/form-data
                  if (tool.name === 'uploadFile') {
                    const { petId, additionalMetadata, file } = cleanArgs;
                    let curlCommand = `curl -X POST \
  'http://petstore.swagger.io/v2/pet/${petId}/uploadImage' \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data'`;
                    
                    if (additionalMetadata) {
                      curlCommand += ` \
  -F 'additionalMetadata=${additionalMetadata}'`;
                    }
                    
                    if (file) {
                      curlCommand += ` \
  -F 'file=@${file}'`;
                    } else {
                      curlCommand += ` \
  -F 'file=@/path/to/your/file.jpg'`;
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      jsonrpc: '2.0',
                      id: message.id,
                      result: {
                        content: [{
                          type: 'text',
                          text: `Here's the cURL command to upload a file:\n\`\`\`bash\n${curlCommand}\n\`\`\``
                        }]
                      }
                    }));
                    return;
                  }
                  
                  // For other tools, generate a simple cURL command
                  const queryParams = new URLSearchParams();
                  const bodyParams: Record<string, any> = {};
                  
                  Object.entries(cleanArgs).forEach(([key, value]) => {
                    if (typeof value === 'string' || typeof value === 'number') {
                      queryParams.append(key, String(value));
                    } else {
                      bodyParams[key] = value;
                    }
                  });
                  
                  let curlCommand = `curl -X POST \
  'http://petstore.swagger.io/v2${tool.inputSchema.path}${queryParams.toString() ? '?' + queryParams.toString() : ''}' \
  -H 'accept: application/json'`;
                
                  if (Object.keys(bodyParams).length > 0) {
                    curlCommand += ` \
  -H 'Content-Type: application/json' \
  -d '${JSON.stringify(bodyParams)}'`;
                  }
                  
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id: message.id,
                    result: {
                      content: [{
                        type: 'text',
                        text: `Here's the cURL command for ${toolName}:\n\`\`\`bash\n${curlCommand}\n\`\`\``
                      }]
                    }
                  }));
                  
                } catch (error) {
                  console.error('❌ Error generating cURL command:', error);
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id: message.id,
                    error: { 
                      code: -32603, 
                      message: 'Internal error generating cURL command',
                      data: error instanceof Error ? error.message : String(error)
                    }
                  }));
                }
                return;
              }
              
              // Default response for unhandled methods
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                error: { code: -32601, message: 'Method not found' }
              }));
              
            } catch (error) {
              console.error('❌ Error handling MCP message:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              try {
                const parsedMessage = JSON.parse(body);
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id: parsedMessage?.id || null,
                  error: { code: -32603, message: 'Internal error' }
                }));
              } catch (e) {
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id: null,
                  error: { code: -32700, message: 'Parse error' }
                }));
              }
            }
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32601, message: 'Method not found' }
          }));
        }
      });
      
      this.server.on('error', (error) => {
        console.error('❌ MCP Server error:', error);
        reject(error);
      });
      
      this.server.listen(port, () => {
        console.log(`✅ MCP HTTP server started on port ${port}`);
        this.isServerReady = true;
        this.loadTools().then(() => {
          console.log(`✅ MCP server ready with ${this.tools.length} tools`);
          resolve();
        }).catch(reject);
      });
    });
  }

  private async sendMCPMessage(message: any): Promise<any> {
    if (!this.isServerReady && message.method !== "initialize") {
      throw new Error("MCP server not ready");
    }

    const options = {
      hostname: "localhost",
      port: 3000,
      path: "/mcp",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res: any) => {
        let data = "";
        res.on("data", (chunk: string) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on("error", (error: Error) => {
        reject(error);
      });

      message.jsonrpc = "2.0";
      message.id = this.messageId++;
      req.write(JSON.stringify(message));
      req.end();
    });
  }

  /**
   * Register a tool with the bridge
   * @param tool The tool definition to register
   */
  public registerTool(tool: MCPTool): void {
    if (!tool.name || !tool.description || !tool.inputSchema) {
      console.warn('⚠️ Invalid tool definition, skipping:', tool.name || 'unnamed-tool');
      return;
    }
    
    // Check if tool already exists
    const existingIndex = this.tools.findIndex(t => t.name === tool.name);
    if (existingIndex >= 0) {
      console.log(`🔄 Updating existing tool: ${tool.name}`);
      this.tools[existingIndex] = tool;
    } else {
      console.log(`✅ Registered tool: ${tool.name}`);
      this.tools.push(tool);
    }
  }

  /**
   * Register multiple tools at once
   * @param tools Array of tool definitions to register
   */
  public registerTools(tools: MCPTool[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  private async loadTools(): Promise<void> {
    try {
      // First try to load tools from the MCP server
      try {
        const result = await this.sendMCPMessage({
          method: "tools/list",
        });
        
        if (result.tools && Array.isArray(result.tools)) {
          this.tools = result.tools;
        }
      } catch (error) {
        console.warn("⚠️ Could not load tools from MCP server, using local tools only");
      }

      // Log available tools
      if (this.tools.length > 0) {
        console.log("📋 Available tools:");
        this.tools.forEach((tool, index) => {
          console.log(`   ${index + 1}. ${tool.name}: ${tool.description || 'No description'}`);
        });
      } else {
        console.log("ℹ️ No tools available. Use registerTool() to add tools.");
      }
    } catch (error) {
      console.error("❌ Failed to load tools:", error);
      throw error;
    }
  }

  async generateCurlCommand(
    toolName: string,
    parameters: Record<string, any>
  ): Promise<string> {
    try {
      console.log(`🔄 Generating cURL for tool: ${toolName}`);
      console.log(`📝 Parameters:`, JSON.stringify(parameters, null, 2));

      // Get the tool definition
      const tool = this.tools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      // Create a prompt for OpenAI to generate the cURL command
      const prompt = `Generate a cURL command for the following API endpoint:

Tool Name: ${toolName}
Description: ${tool.description}
Parameters: ${JSON.stringify(parameters, null, 2)}

Please provide a properly formatted cURL command that can be used to call this API endpoint with the given parameters. 
Include all necessary headers and format the request body as needed.

cURL command:`;

      console.log('📤 Sending request to OpenAI to generate cURL command...');
      
      try {
        // Call OpenAI to generate the cURL command
        const response = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that generates cURL commands for API endpoints. " +
                      "You will be given a tool name, description, and parameters, and you should " +
                      "return a properly formatted cURL command that can be used to call the API."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500,
        });

        const curlCommand = response.choices[0]?.message?.content?.trim();
        
        if (!curlCommand) {
          throw new Error('No cURL command was generated by OpenAI');
        }

        console.log('✅ Generated cURL command:', curlCommand);
        return curlCommand;
        
      } catch (error) {
        console.error('❌ Error calling OpenAI:', error);
        throw new Error(`Failed to generate cURL command using OpenAI: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('❌ Error in generateCurlCommand:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate cURL: ${errorMessage}`);
    }
  }

  async askGPTAboutCurl(
    curlCommand: string,
    userQuestion: string
  ): Promise<string> {
    try {
      console.log("🤖 Sending to GPT for analysis...");

      const prompt = `Here's a cURL command that was generated from an API tool:

\`\`\`bash
${curlCommand}
\`\`\`

User question: ${userQuestion}

Please analyze this cURL command and provide helpful insights. Include:
1. What this API call does
2. The parameters and headers being used
3. Expected response format
4. Any suggestions for improvement or modifications
5. Answer to the user's specific question

Be practical and specific in your response.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert API developer. Analyze cURL commands and provide helpful, practical insights. Be specific and actionable in your responses.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      const gptResponse = response.choices[0]?.message?.content;
      if (!gptResponse) {
        throw new Error("No response from GPT");
      }

      return gptResponse;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`GPT API error: ${errorMessage}`);
    }
  }

  async processWorkflow(
    toolName: string,
    parameters: Record<string, any>,
    userQuestion: string
  ): Promise<string> {
    console.log(`\n🔄 Processing workflow for tool: ${toolName}`);

    try {
      // Step 1: Generate cURL command
      const curlCommand = await this.generateCurlCommand(toolName, parameters);

      // Step 2: Send to GPT for analysis
      const gptResponse = await this.askGPTAboutCurl(curlCommand, userQuestion);

      return `## 🔧 Generated cURL Command:
\`\`\`bash
${curlCommand}
\`\`\`

## 🤖 GPT Analysis:
${gptResponse}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Workflow error: ${errorMessage}`);
    }
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  cleanup(): void {
    if (this.server) {
      this.server.close();
      console.log('🛑 MCP HTTP server stopped');
     }
    this.isServerReady = false;
  }
}
