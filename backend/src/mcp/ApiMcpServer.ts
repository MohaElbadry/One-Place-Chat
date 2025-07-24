import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition } from "../types/openapi.types.js";

export class ApiMcpServer {
  private server: Server;
  private apiTools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: "openapi-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Register tools generated from OpenAPI specs
   */
  public registerTools(tools: ToolDefinition[]) {
    tools.forEach(tool => {
      try {
        if (this.validateToolSchema(tool)) {
          this.apiTools.set(tool.name, tool);
        } else {
          const toolName = (tool as any)?.name || 'unknown';
          console.error(`Invalid tool schema for: ${toolName}`);
        }
      } catch (error) {
        console.error('Error registering tool:', error);
      }
    });
    console.log(`Processed ${tools.length} API tools`);
  }

  private validateToolSchema(tool: unknown): tool is ToolDefinition {
    if (!tool || typeof tool !== 'object') {
      console.error('Invalid tool: not an object');
      return false;
    }
    
    const toolObj = tool as Record<string, unknown>;
    const name = toolObj.name as string | undefined;
    const endpoint = toolObj.endpoint as Record<string, unknown> | undefined;
    
    const isValid = Boolean(
      typeof name === 'string' &&
      typeof toolObj.description === 'string' &&
      toolObj.inputSchema &&
      endpoint &&
      typeof endpoint.method === 'string' &&
      typeof endpoint.path === 'string' &&
      typeof endpoint.baseUrl === 'string'
    );
    
    if (!isValid) {
      const toolName = name || 'unknown';
      console.error(`Invalid tool schema for tool: ${toolName}`);
    }
    
    return isValid;
  }

  private setupHandlers() {
    // List all available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        // Base tools
        {
          name: "list_loaded_tools",
          description: "List all currently loaded API tools with their details",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false
          },
          annotations: {
            title: "List Loaded API Tools",
            readOnlyHint: true
          }
        },
        // Add all registered API tools
        ...Array.from(this.apiTools.entries()).map(([name, tool]) => ({
          name: `api_${name}`,
          description: `${tool.description} (${tool.endpoint.method} ${tool.endpoint.path})`,
          inputSchema: {
            ...tool.inputSchema,
            properties: {
              ...tool.inputSchema.properties,
              _authToken: {
                type: "string",
                description: "Authentication token (optional)"
              },
              _generateCurlOnly: {
                type: "boolean",
                description: "If true, only generate cURL command",
                default: false
              }
            }
          },
          annotations: {
            title: tool.name,
            openWorldHint: true,
            ...tool.annotations
          }
        }))
      ];

      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "list_loaded_tools") {
        return await this.handleListLoadedTools();
      } 
      // Handle API tool execution
      if (name.startsWith("api_")) {
        const toolName = name.substring(4);
        if (this.apiTools.has(toolName)) {
          const { _authToken, _generateCurlOnly, ...parameters } = args as any;
          return await this.handleExecuteApiTool({
            toolName,
            parameters,
            authToken: _authToken,
            generateCurlOnly: _generateCurlOnly
          });
        }
      }
      
      throw new Error(`Unknown tool: ${name}`);
    });
  }

  private async handleListLoadedTools() {
    const tools = Array.from(this.apiTools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description,
      method: tool.endpoint.method,
      path: tool.endpoint.path,
      baseUrl: tool.endpoint.baseUrl,
      requiresAuth: !!(tool.security && tool.security.length > 0)
    }));

    return {
      content: [{
        type: "text",
        text: `Loaded API Tools (${tools.length}):\n\n${JSON.stringify(tools, null, 2)}`
      }]
    };
  }

  private async handleExecuteApiTool(params: {
    toolName: string;
    parameters: Record<string, any>;
    authToken?: string;
    generateCurlOnly?: boolean;
  }) {
    const { toolName, parameters, authToken, generateCurlOnly = false } = params;
    const tool = this.apiTools.get(toolName);
    
    if (!tool) {
      throw new Error(`API tool not found: ${toolName}`);
    }

    // Build and execute the request
    const request = this.buildRequest(tool, parameters, authToken);
    
    if (generateCurlOnly) {
      return {
        content: [{
          type: "text",
          text: this.generateCurlCommand(request)
        }]
      };
    }

    // Execute the actual request
    try {
      const response = await this.executeRequest(request);
      return {
        content: [{
          type: "text",
          text: `Response from ${toolName} (${response.status}):\n\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  private buildRequest(tool: ToolDefinition, parameters: Record<string, any>, authToken?: string) {
    // Replace path parameters
    let path = tool.endpoint.path;
    const pathParams: Record<string, any> = {};
    
    // Extract path parameters
    Object.entries(parameters).forEach(([key, value]) => {
      if (path.includes(`{${key}}`)) {
        pathParams[key] = value;
        path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
      }
    });

    // Prepare URL
    const url = new URL(path, tool.endpoint.baseUrl);
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Add auth header if provided
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Prepare query parameters and body
    let body: string | undefined;
    const queryParams: Record<string, string> = {};
    
    // Separate query parameters from body parameters
    Object.entries(parameters).forEach(([key, value]) => {
      if (!pathParams[key] && value !== undefined) {
        if (['GET', 'HEAD', 'DELETE'].includes(tool.endpoint.method)) {
          queryParams[key] = String(value);
        }
      }
    });

    // Add query parameters to URL
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    // Prepare request body for non-GET/HEAD/DELETE methods
    if (!['GET', 'HEAD', 'DELETE'].includes(tool.endpoint.method)) {
      const bodyParams = { ...parameters };
      // Remove path and query params from body
      Object.keys(pathParams).forEach(key => delete bodyParams[key]);
      Object.keys(queryParams).forEach(key => delete bodyParams[key]);
      
      if (Object.keys(bodyParams).length > 0) {
        body = JSON.stringify(bodyParams);
      }
    }

    return {
      method: tool.endpoint.method,
      url: url.toString(),
      headers,
      body
    };
  }

  private generateCurlCommand(request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  }): string {
    let curl = `curl -X ${request.method}`;
    
    // Add headers
    Object.entries(request.headers).forEach(([key, value]) => {
      curl += ` -H "${key}: ${value}"`;
    });
    
    // Add body
    if (request.body) {
      curl += ` -d '${request.body.replace(/'/g, "\\'")}'`;
    }
    
    // Add URL (properly escaped)
    curl += ` '${request.url.replace(/'/g, "\\'")}'`;
    
    return curl;
  }

  private async executeRequest(request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  }) {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    let data;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data
    };
  }

  /**
   * Start the MCP server
   */
  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("OpenAPI MCP server running on stdio");
  }
}
