/**
 * MCP (Machine-Readable API Client) Tool Generator
 * 
 * This module generates MCP tools from OpenAPI/Swagger specifications.
 * It processes API documentation and creates executable tools that can interact with the defined API endpoints.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { DocumentType, DocumentChunk, DocumentChunkType, EndpointInfo } from '../types/document.types';
import { MCPTool, MCPToolGenerationResult, MCPToolGenerationMetadata } from '../types/mcp-tool.types';

/**
 * Main class for generating MCP tools from API specifications.
 * 
 * The MCPToolGenerator processes OpenAPI/Swagger documents and generates corresponding
 * tools that can be used to interact with the API endpoints. It handles various aspects
 * of API documentation including:
 * - Authentication methods
 * - Request/response schemas
 * - Parameter validation
 */
export class MCPToolGenerator {
  private readonly maxChunkSize: number;
  private readonly chunkOverlap: number;
  private readonly supportedFormats = ['openapi', 'swagger', 'postman'];

  /**
   * Creates a new instance of MCPToolGenerator with the specified options.
   */
  constructor(
    private options: {
      /** Maximum size of each chunk when processing large documents */
      maxChunkSize?: number;
      
      /** Number of lines to overlap between chunks */
      chunkOverlap?: number;
    } = {}
  ) {
    this.maxChunkSize = options.maxChunkSize || 10000;
    this.chunkOverlap = options.chunkOverlap || 500;
  }

  /**
   * Generates MCP tools from an API specification document.
   * 
   * This is the main entry point that orchestrates the entire process:
   * 1. Loads and validates the API specification
   * 2. Chunks the document for efficient processing
   * 3. Extracts endpoint information
   * 4. Generates MCP tools for each endpoint
   * 5. Optimizes and returns the results
   */
  public async generateMCPTools(documentPath: string): Promise<MCPToolGenerationResult> {
    const startTime = Date.now();
    
    // Load and validate the API document
    const document = await this.loadDocument(documentPath);
    const { valid, error } = this.validateDocument(document);
    
    if (!valid) {
      throw new Error(`Invalid API document: ${error}`);
    }

    // Process the document in chunks for better memory management
    const chunks = this.chunkDocument(document);
    const endpoints: EndpointInfo[] = [];

    // Process each chunk to extract endpoints
    for (const chunk of chunks) {
      const chunkEndpoints = await this.processChunk(chunk, document);
      endpoints.push(...chunkEndpoints);
    }

    // Generate tools from the extracted endpoints
    const tools = this.generateToolsFromEndpoints(endpoints, document);
    const optimizedTools = this.optimizeTools(tools);

    return {
      tools: optimizedTools,
      metadata: {
        totalEndpoints: endpoints.length,
        processedChunks: chunks.length,
        apiInfo: {
          title: document.info?.title,
          version: document.info?.version,
          description: document.info?.description,
        },
        processingTime: Date.now() - startTime,
      },
    };
  }

  /** Loads an API specification document from a file path or URL. */
  private async loadDocument(documentPath: string): Promise<DocumentType> {
    try {
      let content: string;
      
      if (this.isUrl(documentPath)) {
        const response = await axios.get(documentPath);
        content = JSON.stringify(response.data);
      } else {
        content = fs.readFileSync(documentPath, 'utf-8');
      }

      return JSON.parse(content);
    } catch (error: any) {
      throw new Error(`Failed to load document: ${error.message}`);
    }
  }

  /**
   * Validates that the document is a valid OpenAPI/Swagger specification.
   */
  private validateDocument(document: any): { valid: boolean; error?: string } {
    if (!document) return { valid: false, error: 'Document is empty' };
    if (!document.openapi && !document.swagger) {
      return { valid: false, error: 'Not a valid OpenAPI/Swagger document' };
    }
    return { valid: true };
  }

  /** Splits the API document into manageable chunks for processing. 
   *  This method handles large documents by breaking them into smaller pieces,
   * which helps with memory management and allows for parallel processing.
   */
  private chunkDocument(document: DocumentType): DocumentChunk[] {
    // Implementation for chunking the document
    // This is a simplified version - actual implementation would handle different parts of the spec
    return [{
      id: 'main',
      content: document.paths || {},
      type: 'paths',
      startLine: 0,
      endLine: 100, // This would be calculated in a real implementation
      references: []
    }];
  }

  /**
   * Processes a single chunk of the API document to extract endpoint information.
   */
  private async processChunk(chunk: DocumentChunk, fullDocument: any): Promise<EndpointInfo[]> {
    const endpoints: EndpointInfo[] = [];
    
    if (chunk.type === 'paths') {
      for (const [path, methods] of Object.entries(chunk.content as Record<string, any>)) {
        for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
          if (this.isValidHttpMethod(method)) {
            const endpoint = this.extractEndpointInfo(path, method, operation, fullDocument);
            if (endpoint) endpoints.push(endpoint);
          }
        }
      }
    }
    
    return endpoints;
  }

  /**
   * Extracts relevant information from an API endpoint definition.
   */
  private extractEndpointInfo(
    path: string,
    method: string,
    operation: any,
    fullDocument: any
  ): EndpointInfo | null {
    if (!operation.operationId) return null;

    return {
      path,
      method,
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      parameters: operation.parameters || [],
      requestBody: operation.requestBody,
      responses: operation.responses || {},
      security: operation.security,
      tags: operation.tags
    };
  }

  /**
   * Converts extracted endpoint information into MCP tools.
   */
  private generateToolsFromEndpoints(endpoints: EndpointInfo[], document: any): MCPTool[] {
    return endpoints
      .map(endpoint => this.createMCPTool(endpoint, document))
      .filter((tool): tool is MCPTool => tool !== null);
  }

  /**
   * Creates a single MCP tool from an endpoint definition.
   */
  private createMCPTool(endpoint: EndpointInfo, document: any): MCPTool | null {
    const name = this.generateToolName(endpoint);
    const inputSchema = this.createInputSchema(endpoint, document);
    const annotations = this.createAnnotations(endpoint);

    return {
      name,
      description: endpoint.description || endpoint.summary,
      inputSchema,
      annotations: {
        ...annotations,
        title: endpoint.summary || name
      }
    };
  }

  /**
   * Generates a unique name for a tool based on its endpoint information.
   * 
   * The naming strategy is as follows:
   * 1. If operationId is present, convert it to camelCase
   * 2. Otherwise, generate from path and method (e.g., 'getUsersById')
   */
  private generateToolName(endpoint: EndpointInfo): string {
    // Convert operationId to camelCase or generate from path/method
    if (endpoint.operationId) {
      return endpoint.operationId.replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
    }
    
    // Fallback: generate from path and method
    const pathParts = endpoint.path.split('/')
      .filter(Boolean)
      .map(part => part.replace(/[^a-zA-Z0-9]/g, ''));
    
    const method = endpoint.method.toLowerCase();
    const name = `${method}${pathParts.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`;
    
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  /**
   * Creates an input schema for an MCP tool based on the endpoint definition.
   * 
   * The schema includes:
   * - Path parameters
   * - Query parameters
   * - Request body
   * - Headers
   */
  private createInputSchema(endpoint: EndpointInfo, document: any): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Process path parameters
    endpoint.parameters
      ?.filter((p: any) => p.in === 'path')
      .forEach((param: any) => {
        properties[param.name] = {
          type: param.schema?.type || 'string',
          description: param.description,
          default: param.default
        };
        required.push(param.name);
      });

    // Process query parameters
    endpoint.parameters
      ?.filter((p: any) => p.in === 'query')
      .forEach((param: any) => {
        properties[param.name] = {
          type: param.schema?.type || 'string',
          description: param.description,
          default: param.default
        };
        if (param.required) required.push(param.name);
      });

    // Process request body
    if (endpoint.requestBody) {
      const content = endpoint.requestBody.content;
      const schema = content?.['application/json']?.schema;
      
      if (schema) {
        properties.body = {
          type: 'object',
          properties: schema.properties || {},
          required: schema.required || []
        };
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };
  }

  /**
   * Creates annotations for an MCP tool based on the endpoint definition.
   * 
   * The annotations include:
   * - readOnlyHint
   * - destructiveHint
   * - idempotentHint
   * - openWorldHint
   */
  private createAnnotations(endpoint: EndpointInfo) {
    const method = endpoint.method.toLowerCase();
    const isReadOnly = ['get', 'head', 'options'].includes(method);
    const isDestructive = ['delete'].includes(method);
    const isIdempotent = ['get', 'put', 'delete', 'head', 'options'].includes(method);

    return {
      readOnlyHint: isReadOnly,
      destructiveHint: isDestructive,
      idempotentHint: isIdempotent,
      openWorldHint: false
    };
  }

  /**
   * Removes duplicate tools and optimizes schemas.
   */
  private optimizeTools(tools: MCPTool[]): MCPTool[] {
    return this.removeDuplicateTools(tools).map(tool => this.optimizeToolSchema(tool));
  }

  /**
   * Removes duplicate tools.
   */
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

  /**
   * Optimizes tool schema by removing empty properties.
   */
  private optimizeToolSchema(tool: MCPTool): MCPTool {
    const optimized = { ...tool };

    if (optimized.inputSchema.required?.length === 0) {
      delete optimized.inputSchema.required;
    }

    return optimized;
  }


  private isUrl(path: string): boolean {
    try {
      new URL(path);
      return true;
    } catch {
      return false;
    }
  }


  private isValidHttpMethod(method: string): method is 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head' {
    return ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase());
  }
}
