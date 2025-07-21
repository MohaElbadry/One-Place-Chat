import { OpenAI } from 'openai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AxiosResponse, AxiosError } from 'axios';

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, any>>;
  components?: {
    securitySchemes?: Record<string, any>;
    schemas?: Record<string, any>;
  };
  security?: Array<Record<string, any>>;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  endpoint: {
    method: string;
    path: string;
    baseUrl: string;
  };
  security?: any;
}

export class ToolGenerator {
  private openai: InstanceType<typeof OpenAI>;
  
  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey
    });
  }

  /**
   * Generate TypeScript implementation for an API operation
   */
  private async generateTypeScriptImplementation(operation: any, path: string, method: string, baseUrl: string): Promise<string> {
    const prompt = this.buildTypeScriptPrompt(operation, path, method, baseUrl);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are a senior TypeScript developer specialized in generating production-ready API clients from OpenAPI specifications.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating TypeScript implementation:', error);
      throw new Error(`Failed to generate TypeScript implementation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build the prompt for TypeScript code generation
   */
  private buildTypeScriptPrompt(operation: any, path: string, method: string, baseUrl: string): string {
    return `# OpenAPI Tool Implementation Generator

## Code Style Requirements
- Use strict TypeScript typing
- Avoid using 'with' statements
- Use proper module imports/exports
- Use template literals for string interpolation
- Follow TypeScript best practices

## Operation Details
- Path: ${path}
- Method: ${method.toUpperCase()}
- Operation ID: ${operation.operationId || 'N/A'}
- Summary: ${operation.summary || 'No summary provided'}
- Description: ${operation.description || 'No description provided'}

## Request Parameters
${this.formatParameters(operation.parameters || [])}

## Request Body
${this.formatRequestBody(operation.requestBody)}

## Responses
${this.formatResponses(operation.responses || {})}

## Security
${this.formatSecurity(operation.security || [])}

## Your Task
Generate a complete, production-ready TypeScript implementation for this API operation following these requirements:

1. Create proper TypeScript interfaces for all request/response types
2. Implement the function with proper error handling and type safety
3. Include JSDoc comments with parameter descriptions and return types
4. Use axios for HTTP requests with proper type annotations
5. Handle all specified parameters and authentication
6. Include proper error handling with typed error responses
7. Use strict TypeScript mode ("strict": true)
8. Follow the structure:
   - ES Module imports at the top
   - Type definitions and interfaces
   - Main function implementation with proper error handling
   - Export statements

## Important Notes:
- Do not use 'with' statements
- Always use proper TypeScript types
- Use template literals for string interpolation
- Ensure all variables are properly typed
- Use async/await for asynchronous operations
- Include proper error handling with try/catch blocks
- Use proper TypeScript module syntax (import/export)
   - Export statements

Output only the TypeScript code, no explanations or markdown formatting.`;
  }

  /**
   * Format parameters for the prompt
   */
  private formatParameters(parameters: any[]): string {
    if (!parameters || parameters.length === 0) return 'No parameters';
    
    return parameters.map(param => {
      return `- ${param.name} (${param.in}): ${param.schema?.type || 'any'}${param.required ? ' (required)' : ''}
  ${param.description || 'No description'}`;
    }).join('\n\n');
  }

  /**
   * Format request body for the prompt
   */
  private formatRequestBody(requestBody: any): string {
    if (!requestBody) return 'No request body';
    
    const content = requestBody.content || {};
    return Object.entries(content).map(([contentType, schema]: [string, any]) => {
      return `Content-Type: ${contentType}\n${JSON.stringify(schema.schema || {}, null, 2)}`;
    }).join('\n\n');
  }

  /**
   * Format responses for the prompt
   */
  private formatResponses(responses: Record<string, any>): string {
    return Object.entries(responses).map(([status, response]) => {
      const content = response.content ? 
        Object.entries(response.content).map(([contentType, schema]) => 
          `  ${contentType}: ${JSON.stringify((schema as any).schema || {}, null, 2)}`
        ).join('\n') :
        '  No content';
      
      return `${status}: ${response.description || 'No description'}\n${content}`;
    }).join('\n\n');
  }

  /**
   * Format security requirements for the prompt
   */
  private formatSecurity(security: any[]): string {
    if (!security || security.length === 0) return 'No security requirements';
    return JSON.stringify(security, null, 2);
  }

  /**
   * Parse OpenAPI spec and extract tool definitions
   */
  parseOpenAPISpec(spec: OpenAPISpec): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    const baseUrl = spec.servers?.[0]?.url || '';//TODO: handle empty servers array
    
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!operation.operationId) continue;
        
        const toolName = this.convertOperationIdToToolName(operation.operationId);
        
        tools.push({
          name: toolName,
          description: operation.summary || operation.description || `${method.toUpperCase()} ${path}`,
          inputSchema: this.extractInputSchema(operation, path),
          endpoint: {
            method: method.toUpperCase(),
            path,
            baseUrl
          },
          security: spec.security || operation.security
        });
      }
    }
    
    return tools;
  }

  /**
   * Convert operationId to camelCase tool name
   */
  private convertOperationIdToToolName(operationId: string): string {
    return operationId
      .split(/[-_\s]+/)
      .map((word, index) => 
        index === 0 
          ? word.toLowerCase() 
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }

  /**
   * Extract input schema from OpenAPI operation
   */
  private extractInputSchema(operation: any, path: string): any {
    const schema: any = {
      type: "object",
      properties: {},
      required: []
    };

    // Path parameters
    const pathParams = path.match(/\{([^}]+)\}/g);
    if (pathParams) {
      pathParams.forEach(param => {
        const paramName = param.slice(1, -1);
        schema.properties[paramName] = {
          type: "string",
          description: `Path parameter: ${paramName}`
        };
        schema.required.push(paramName);
      });
    }

    // Query parameters
    if (operation.parameters) {
      operation.parameters.forEach((param: any) => {
        if (param.in === 'query') {
          schema.properties[param.name] = {
            type: param.schema?.type || "string",
            description: param.description || `Query parameter: ${param.name}`
          };
          if (param.required) {
            schema.required.push(param.name);
          }
        }
      });
    }

    // Request body
    if (operation.requestBody) {
      const content = operation.requestBody.content;
      if (content?.['application/json']?.schema) {
        schema.properties.body = {
          type: "object",
          properties: {
            RAW_BODY: {
              type: "string",
              format: "json",
              description: "JSON request body"
            }
          },
          required: ["RAW_BODY"]
        };
      }
    }

    return schema;
  }

  /**
   * Generate tool implementation using OpenAI
   */
  async generateToolImplementation(
    tool: ToolDefinition, 
    apiSpec: OpenAPISpec
  ): Promise<string> {
    const prompt = `Generate a TypeScript implementation for the following API tool:

**Tool Name:** ${tool.name}
**Description:** ${tool.description}
**Method:** ${tool.endpoint.method}
**Path:** ${tool.endpoint.path}
**Base URL:** ${tool.endpoint.baseUrl} //TODO: handle empty servers array

**Input Schema:**
${JSON.stringify(tool.inputSchema, null, 2)}

**Security:**
${JSON.stringify(tool.security, null, 2)}

**API Info:**
- API: ${apiSpec.info.title} v${apiSpec.info.version}
- Security Schemes: ${JSON.stringify(apiSpec.components?.securitySchemes, null, 2)}

Please generate a complete TypeScript function that implements this tool. The function should:
1. Take the input parameters as defined in the schema
2. Make an HTTP request to the API endpoint
3. Handle errors appropriately
4. Return the API response

Format your response as a TypeScript function that can be directly used.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert TypeScript developer. Generate clean, production-ready code that implements the specified API tool."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }
  }

  /**
   * Generate implementations for all tools in the OpenAPI spec
   */
  async generateToolImplementations(
    spec: OpenAPISpec,
    outputDir: string
  ): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    const baseUrl = spec.servers?.[0]?.url || '';
    const operations: Array<{path: string; method: string; operation: any}> = [];
    
    // First, collect all operations
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
        if (typeof operation === 'object' && operation.operationId) {
          operations.push({ path, method, operation });
        }
      }
    }
    
    // Process each operation and generate TypeScript code
    for (const { path: endpointPath, method, operation } of operations) {
      try {
        const tsCode = await this.generateTypeScriptImplementation(operation, endpointPath, method, baseUrl);
        const fileName = `${operation.operationId || `${method}_${endpointPath.replace(/[\{\}/]/g, '_')}`}.ts`;
        const filePath = path.join(outputDir, fileName);
        
        await fs.writeFile(filePath, tsCode, 'utf-8');
        console.log(`✅ Generated: ${filePath}`);
      } catch (error) {
        console.error(`❌ Failed to generate implementation for ${method.toUpperCase()} ${path}:`, 
          error instanceof Error ? error.message : String(error));
      }
    }
    
    // Generate index.ts with all exports
    await this.generateIndexFile(outputDir, operations);
  }
  
  /**
   * Generate index.ts file with all exports
   */
  private async generateIndexFile(outputDir: string, operations: Array<{operation: any}>): Promise<void> {
    const exportStatements = operations
      .filter(({ operation }) => operation.operationId)
      .map(({ operation }) => `export * from './${operation.operationId}';`);
    
    await fs.writeFile(
      path.join(outputDir, 'index.ts'),
      `// Auto-generated API client
// Generated at: ${new Date().toISOString()}

${exportStatements.join('\n')}
`,
      'utf-8'
    );
  }
}

// Export types for external use
export type { OpenAPISpec, ToolDefinition };
