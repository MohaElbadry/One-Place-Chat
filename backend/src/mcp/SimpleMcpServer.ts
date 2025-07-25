import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { URL } from 'url';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  endpoint: {
    method: string;
    path: string;
    baseUrl: string;
  };
  annotations: {
    method: string;
    path: string;
    tags?: string[];
    deprecated?: boolean;
    title?: string;
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
  };
  security?: any[];
  execute: (params: any) => Promise<any>;
}

export class SimpleMcpServer {
  private tools: ToolDefinition[] = [];
  private server: Server | null = null;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
  }

  public async loadTools(tools: ToolDefinition[]): Promise<void> {
    this.tools = tools;
    console.log(`✅ Loaded ${tools.length} tools`);
  }

  public async start(): Promise<void> {
    if (this.server) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = createServer(this.handleRequest.bind(this));
      
      this.server.listen(this.port, () => {
        console.log(`✅ MCP Server running on port ${this.port}`);
        resolve();
      }).on('error', (err: Error) => {
        console.error('❌ Failed to start server:', err);
        reject(err);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server?.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('🛑 MCP Server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { method, url } = req;
    const parsedUrl = new URL(url || '', `http://localhost:${this.port}`);
    const path = parsedUrl.pathname;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Only handle POST requests
    if (method !== 'POST') {
      this.sendResponse(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    try {
      // Read and parse request body
      const body = await this.readRequestBody(req);
      const request = JSON.parse(body);

      // Handle different MCP methods
      let result;
      if (path === '/listTools') {
        result = await this.handleListTools(request);
      } else if (path === '/callTool') {
        result = await this.handleCallTool(request);
      } else {
        throw new Error(`Unknown endpoint: ${path}`);
      }

      this.sendResponse(res, 200, { result });
    } catch (error: any) {
      console.error('Request error:', error);
      this.sendResponse(res, 400, { 
        error: {
          code: 400,
          message: error.message || 'Bad Request',
          data: error.data
        }
      });
    }
  }

  private async handleListTools(request: any): Promise<any> {
    const { limit = 20, offset = 0 } = request.params || {};
    const tools = this.tools
      .slice(offset, offset + limit)
      .map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
        endpoint: tool.endpoint,
        annotations: tool.annotations
      }));

    return {
      tools,
      total: this.tools.length
    };
  }

  private async handleCallTool(request: any): Promise<any> {
    const { name, parameters } = request.params || {};
    
    if (!name) {
      throw new Error('Tool name is required');
    }

    const tool = this.tools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      const result = await tool.execute(parameters || {});
      return { result };
    } catch (error: any) {
      console.error(`Error executing tool ${name}:`, error);
      throw new Error(`Failed to execute tool: ${error.message}`);
    }
  }

  private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', (err: Error) => {
        reject(err);
      });
    });
  }
}
