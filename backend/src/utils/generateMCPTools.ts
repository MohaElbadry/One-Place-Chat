import * as fs from "fs";
import * as path from "path";
import axios from "axios";

// MCP Tool Definition Interface
interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

// Document Chunk Interface
interface DocumentChunk {
  id: string;
  content: any;
  document?: any;
  type: "paths" | "components" | "definitions" | "security" | "info";
  startLine: number;
  endLine: number;
  references: string[];
}

// Endpoint Information
interface EndpointInfo {
  path: string;
  method: string;
  operationId: string;
  summary?: string;
  description?: string;
  parameters: any[];
  requestBody?: any;
  responses: any;
  security?: any[];
  tags?: string[];
}

export class MCPToolGenerator {
  private maxChunkSize: number = 10000; // characters
  private chunkOverlap: number = 500; // characters
  private supportedFormats = ["openapi", "swagger", "postman"];

  constructor(
    options: {
      maxChunkSize?: number;
      chunkOverlap?: number;
    } = {}
  ) {
    this.maxChunkSize = options.maxChunkSize || 10000;
    this.chunkOverlap = options.chunkOverlap || 500;
  }

  /**
   * Main workflow: Process API documentation and generate MCP tools
   */
  async generateMCPTools(documentPath: string): Promise<{
    tools: MCPTool[];
    metadata: {
      totalEndpoints: number;
      processedChunks: number;
      apiInfo: any;
      processingTime: number;
    };
  }> {
    const startTime = Date.now();

    console.log("🚀 Starting MCP Tool Generation...");

    // Step 1: Load and validate documentation
    const document = await this.loadDocument(documentPath);
    const validationResult = this.validateDocument(document);

    if (!validationResult.valid) {
      throw new Error(`Invalid document: ${validationResult.error}`);
    }

    // Step 2: Smart chunking for large documents
    const chunks = this.chunkDocument(document);
    console.log(`📦 Created ${chunks.length} chunks`);

    // Step 3: Process each chunk and extract endpoints
    const allEndpoints: EndpointInfo[] = [];
    const processedChunks = [];

    for (const chunk of chunks) {
      const endpoints = await this.processChunk(chunk, document);
      allEndpoints.push(...endpoints);
      processedChunks.push(chunk);

      console.log(
        `✅ Processed chunk ${chunk.id}: ${endpoints.length} endpoints`
      );
    }

    // Step 4: Generate MCP tools from endpoints
    const tools = this.generateToolsFromEndpoints(allEndpoints, document);

    // Step 5: Post-process and optimize tools
    const optimizedTools = this.optimizeTools(tools);

    const processingTime = Date.now() - startTime;

    console.log(
      `🎉 Generated ${optimizedTools.length} MCP tools in ${processingTime}ms`
    );

    return {
      tools: optimizedTools,
      metadata: {
        totalEndpoints: allEndpoints.length,
        processedChunks: chunks.length,
        apiInfo: document.info || {},
        processingTime,
      },
    };
  }

  /**
   * Step 1: Load document from path or URL
   */
  private async loadDocument(documentPath: string): Promise<any> {
    console.log(`📄 Loading document from: ${documentPath}`);

    let content: string;

    if (this.isUrl(documentPath)) {
      const response = await axios.get(documentPath);
      content =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
    } else {
      content = fs.readFileSync(documentPath, "utf-8");
    }

    // Try to parse as JSON first, then YAML
    try {
      return JSON.parse(content);
    } catch (jsonError) {
      try {
        // If you have yaml parser: return yaml.parse(content);
        throw new Error("YAML parsing not implemented in this example");
      } catch (yamlError) {
        throw new Error("Unable to parse document as JSON or YAML");
      }
    }
  }

  /**
   * Step 2: Validate document structure
   */
  private validateDocument(document: any): {
    valid: boolean;
    error?: string;
    format?: string;
  } {
    if (!document || typeof document !== "object") {
      return { valid: false, error: "Document is not a valid object" };
    }

    // Check for OpenAPI/Swagger
    if (document.openapi || document.swagger) {
      if (!document.paths) {
        return { valid: false, error: "Missing paths section" };
      }
      return { valid: true, format: document.openapi ? "openapi" : "swagger" };
    }

    // Check for Postman collection
    if (document.info && document.item) {
      return { valid: true, format: "postman" };
    }

    return { valid: false, error: "Unknown document format" };
  }

  /**
   * Step 3: Smart chunking algorithm for large documents
   */
  private chunkDocument(document: any): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // Strategy 1: Structural chunking (preferred for API docs)
    if (document.paths) {
      chunks.push(...this.chunkByPaths(document.paths));
    }

    if (document.components || document.definitions) {
      chunks.push(
        ...this.chunkByComponents(document.components || document.definitions)
      );
    }

    // Strategy 2: Size-based chunking for remaining content
    const remainingContent = this.getRemainingContent(document, chunks);
    if (remainingContent) {
      chunks.push(...this.chunkBySize(remainingContent));
    }

    return chunks;
  }

  /**
   * Chunk by API paths (most important for tool generation)
   */
  private chunkByPaths(paths: any): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const pathEntries = Object.entries(paths);

    let currentChunk: any = {};
    let currentSize = 0;
    let chunkId = 0;

    for (const [path, methods] of pathEntries) {
      const pathSize = JSON.stringify({ [path]: methods }).length;

      if (
        currentSize + pathSize > this.maxChunkSize &&
        Object.keys(currentChunk).length > 0
      ) {
        // Create chunk
        chunks.push({
          id: `paths_${chunkId++}`,
          content: currentChunk,
          type: "paths",
          startLine: 0, // Would need line tracking for exact positions
          endLine: 0,
          references: this.extractReferences(currentChunk),
        });

        currentChunk = {};
        currentSize = 0;
      }

      currentChunk[path] = methods;
      currentSize += pathSize;
    }

    // Add remaining chunk
    if (Object.keys(currentChunk).length > 0) {
      chunks.push({
        id: `paths_${chunkId}`,
        content: currentChunk,
        type: "paths",
        startLine: 0,
        endLine: 0,
        references: this.extractReferences(currentChunk),
      });
    }

    return chunks;
  }

  /**
   * Chunk by components/definitions
   */
  private chunkByComponents(components: any): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const componentEntries = Object.entries(components);

    // Group related components
    const grouped = this.groupRelatedComponents(componentEntries);

    for (const [groupName, groupContent] of Object.entries(grouped)) {
      chunks.push({
        id: `components_${groupName}`,
        content: groupContent,
        type: "components",
        startLine: 0,
        endLine: 0,
        references: this.extractReferences(groupContent),
      });
    }

    return chunks;
  }

  /**
   * Size-based chunking for remaining content
   */
  private chunkBySize(content: any): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const contentStr = JSON.stringify(content);

    for (
      let i = 0;
      i < contentStr.length;
      i += this.maxChunkSize - this.chunkOverlap
    ) {
      const chunkContent = contentStr.slice(i, i + this.maxChunkSize);

      try {
        const parsed = JSON.parse(chunkContent);
        chunks.push({
          id: `size_${chunks.length}`,
          content: parsed,
          type: "info",
          startLine: 0,
          endLine: 0,
          references: [],
        });
      } catch {
        // Handle partial JSON by finding complete objects
        const completeChunk = this.findCompleteJsonChunk(chunkContent);
        if (completeChunk) {
          chunks.push({
            id: `size_${chunks.length}`,
            content: completeChunk,
            type: "info",
            startLine: 0,
            endLine: 0,
            references: [],
          });
        }
      }
    }

    return chunks;
  }

  /**
   * Step 4: Process each chunk and extract endpoints
   */
  private processChunk(
    chunk: DocumentChunk,
    fullDocument: any
  ): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];

    if (chunk.type === "paths") {
      for (const [path, methods] of Object.entries(chunk.content)) {
        for (const [method, operation] of Object.entries(methods as any)) {
          if (this.isValidHttpMethod(method)) {
            const endpoint = this.extractEndpointInfo(
              path,
              method,
              operation as any,
              fullDocument
            );
            if (endpoint) {
              endpoints.push(endpoint);
            }
          }
        }
      }
    }

    return endpoints;
  }

  /**
   * Extract endpoint information from operation
   */
  private extractEndpointInfo(
    path: string,
    method: string,
    operation: any,
    fullDocument: any
  ): EndpointInfo | null {
    try {
      return {
        path,
        method: method.toUpperCase(),
        operationId:
          operation.operationId ||
          `${method}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
        summary: operation.summary,
        description: operation.description,
        parameters: operation.parameters || [],
        requestBody: operation.requestBody,
        responses: operation.responses || {},
        security: operation.security,
        tags: operation.tags,
      };
    } catch (error) {
      console.error(
        `Error extracting endpoint info for ${method} ${path}:`,
        error
      );
      return null;
    }
  }

  /**
   * Step 5: Generate MCP tools from endpoints
   */
  private generateToolsFromEndpoints(
    endpoints: EndpointInfo[],
    document: any
  ): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const endpoint of endpoints) {
      const tool = this.createMCPTool(endpoint, document);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * Create MCP tool from endpoint
   */
  private createMCPTool(endpoint: EndpointInfo, document: any): MCPTool | null {
    try {
      const toolName = this.generateToolName(endpoint);
      const inputSchema = this.createInputSchema(endpoint, document);
      const annotations = this.createAnnotations(endpoint);

      return {
        name: toolName,
        description:
          endpoint.description ||
          endpoint.summary ||
          `${endpoint.method} ${endpoint.path}`,
        inputSchema,
        annotations,
      };
    } catch (error) {
      console.error(
        `Error creating MCP tool for ${endpoint.method} ${endpoint.path}:`,
        error
      );
      return null;
    }
  }

  /**
   * Generate tool name from endpoint
   */
  private generateToolName(endpoint: EndpointInfo): string {
    if (endpoint.operationId) {
      return endpoint.operationId;
    }

    // Generate from method and path
    const method = endpoint.method.toLowerCase();
    const pathParts = endpoint.path
      .split("/")
      .filter((p) => p && !p.startsWith("{"));
    const resource = pathParts[pathParts.length - 1] || "resource";

    return `${method}_${resource}`;
  }

  /**
   * Create input schema for tool
   */
  private createInputSchema(
    endpoint: EndpointInfo,
    document: any
  ): {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add path parameters
    const pathParams =
      endpoint.parameters?.filter((p) => p.in === "path") || [];
    for (const param of pathParams) {
      properties[param.name] = {
        type: param.schema?.type || "string",
        description: param.description,
      };
      if (param.required) {
        required.push(param.name);
      }
    }

    // Add query parameters
    const queryParams =
      endpoint.parameters?.filter((p) => p.in === "query") || [];
    for (const param of queryParams) {
      properties[param.name] = {
        type: param.schema?.type || "string",
        description: param.description,
      };
      if (param.required) {
        required.push(param.name);
      }
    }

    // Add request body properties
    if (endpoint.requestBody) {
      const bodySchema = this.resolveSchema(
        endpoint.requestBody.content?.["application/json"]?.schema,
        document
      );
      if (bodySchema && bodySchema.properties) {
        Object.assign(properties, bodySchema.properties);
        if (bodySchema.required) {
          required.push(...bodySchema.required);
        }
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Create annotations for tool
   */
  private createAnnotations(endpoint: EndpointInfo): MCPTool["annotations"] {
    const annotations: MCPTool["annotations"] = {};

    // Set hints based on HTTP method
    switch (endpoint.method.toUpperCase()) {
      case "GET":
        annotations.readOnlyHint = true;
        annotations.idempotentHint = true;
        break;
      case "POST":
        annotations.readOnlyHint = false;
        annotations.idempotentHint = false;
        break;
      case "PUT":
      case "PATCH":
        annotations.readOnlyHint = false;
        annotations.idempotentHint = true;
        break;
      case "DELETE":
        annotations.readOnlyHint = false;
        annotations.destructiveHint = true;
        annotations.idempotentHint = true;
        break;
    }

    // All API calls interact with external entities
    annotations.openWorldHint = true;

    // Set title
    annotations.title =
      endpoint.summary || `${endpoint.method} ${endpoint.path}`;

    return annotations;
  }

  /**
   * Step 6: Optimize and post-process tools
   */
  private optimizeTools(tools: MCPTool[]): MCPTool[] {
    // Remove duplicates
    const uniqueTools = this.removeDuplicateTools(tools);

    // Optimize schemas
    const optimizedTools = uniqueTools.map((tool) =>
      this.optimizeToolSchema(tool)
    );

    // Sort by name
    return optimizedTools.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Helper methods
  private isUrl(path: string): boolean {
    return path.startsWith("http://") || path.startsWith("https://");
  }

  private isValidHttpMethod(method: string): boolean {
    return [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "head",
      "options",
    ].includes(method.toLowerCase());
  }

  private extractReferences(content: any): string[] {
    const refs: string[] = [];
    const contentStr = JSON.stringify(content);
    const refMatches = contentStr.match(/"\$ref":\s*"([^"]+)"/g);

    if (refMatches) {
      for (const match of refMatches) {
        const ref = match.match(/"([^"]+)"/)?.[1];
        if (ref) {
          refs.push(ref);
        }
      }
    }

    return refs;
  }

  private groupRelatedComponents(
    components: [string, any][]
  ): Record<string, any> {
    // Simple grouping by prefix or type
    const groups: Record<string, any> = {};

    for (const [name, component] of components) {
      const groupName = name.split(/[._-]/)[0] || "default";
      if (!groups[groupName]) {
        groups[groupName] = {};
      }
      groups[groupName][name] = component;
    }

    return groups;
  }

  private getRemainingContent(
    document: any,
    processedChunks: DocumentChunk[]
  ): any {
    // Return parts of document not yet processed
    const processed = new Set();
    for (const chunk of processedChunks) {
      if (chunk.type === "paths") processed.add("paths");
      if (chunk.type === "components") processed.add("components");
    }

    const remaining: any = {};
    for (const [key, value] of Object.entries(document)) {
      if (!processed.has(key)) {
        remaining[key] = value;
      }
    }

    return Object.keys(remaining).length > 0 ? remaining : null;
  }

  private findCompleteJsonChunk(content: string): any {
    // Find the last complete JSON object in the chunk
    let depth = 0;
    let lastComplete = 0;

    for (let i = 0; i < content.length; i++) {
      if (content[i] === "{") depth++;
      if (content[i] === "}") {
        depth--;
        if (depth === 0) {
          lastComplete = i + 1;
        }
      }
    }

    if (lastComplete > 0) {
      try {
        return JSON.parse(content.slice(0, lastComplete));
      } catch {
        return null;
      }
    }

    return null;
  }

  private resolveSchema(schema: any, document: any): any {
    if (!schema) return null;

    if (schema.$ref) {
      const refPath = schema.$ref.replace("#/", "").split("/");
      let resolved = document;
      for (const part of refPath) {
        resolved = resolved?.[part];
      }
      return resolved;
    }

    return schema;
  }

  private removeDuplicateTools(tools: MCPTool[]): MCPTool[] {
    const seen = new Set<string>();
    return tools.filter((tool) => {
      if (seen.has(tool.name)) {
        return false;
      }
      seen.add(tool.name);
      return true;
    });
  }

  private optimizeToolSchema(tool: MCPTool): MCPTool {
    // Remove empty properties
    const optimized = { ...tool };

    if (optimized.inputSchema.required?.length === 0) {
      delete optimized.inputSchema.required;
    }

    return optimized;
  }
}

// Usage example
async function main() {
  const generator = new MCPToolGenerator({
    maxChunkSize: 8000,
    chunkOverlap: 200,
  });

  try {
    const result = await generator.generateMCPTools("../api-docs/Petstore/swagger.json");

    console.log("Generated Tools:");
    for (const tool of result.tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }

    console.log("\nMetadata:", result.metadata);

    // Save tools to file
    fs.writeFileSync(
      "./generated-mcp-tools.json",
      JSON.stringify(result.tools, null, 2)
    );
  } catch (error) {
    console.error("Error generating tools:", error);
  }
}

export default MCPToolGenerator;
