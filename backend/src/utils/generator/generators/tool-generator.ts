import type { MCPTool } from '../types/mcp-tool.types';
import type { EndpointInfo, HttpMethod } from '../types/document.types';

/**
 * Generates MCP tools from API endpoint information
 */
export class ToolGenerator {
  /**
   * Generates MCP tools from endpoint information
   */
  public generateToolsFromEndpoints(
    endpoints: EndpointInfo[],
    document: any
  ): MCPTool[] {
    return endpoints
      .map((endpoint) => this.createMCPTool(endpoint, document))
      .filter((tool): tool is MCPTool => tool !== null);
  }

  /**
   * Creates a single MCP tool from an endpoint definition
   */
  private createMCPTool(endpoint: EndpointInfo, document: any): MCPTool | null {
    const name = this.generateToolName(endpoint);
    const inputSchema = this.createInputSchema(endpoint, document);
    const annotations = this.createAnnotations(endpoint);

    // Ensure inputSchema has the correct type
    const validatedInputSchema = {
      type: 'object' as const,
      properties: inputSchema.properties || {},
      required: inputSchema.required || [],
      ...inputSchema
    };

    return {
      name,
      description: endpoint.description || endpoint.summary || 'No description available',
      inputSchema: validatedInputSchema,
      annotations: annotations,
      parameters: {},
      execute: async () => {
        throw new Error('Not implemented: API calls should be handled by the MCP server');
      }
    };
  }

  /**
   * Generates a unique name for a tool based on its endpoint information
   */
  private generateToolName(endpoint: EndpointInfo): string {
    // Convert operationId to camelCase or generate from path/method
    if (endpoint.operationId) {
      return endpoint.operationId.replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) =>
        chr.toUpperCase()
      );
    }

    // Fallback: generate from path and method
    const pathParts = endpoint.path
      .split('/')
      .filter(Boolean)
      .map((part) => part.replace(/[^a-zA-Z0-9]/g, ''));

    const method = endpoint.method.toLowerCase();
    const name = `${method}${pathParts
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')}`;

    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  /**
   * Creates an input schema for an MCP tool
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
          default: param.default,
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
          default: param.default,
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
          required: schema.required || [],
        };
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Creates annotations for an MCP tool
   */
  private createAnnotations(endpoint: EndpointInfo) {
    const method = endpoint.method.toLowerCase();
    const isReadOnly = ['get', 'head', 'options'].includes(method);
    const isDestructive = ['delete'].includes(method);
    const isIdempotent = ['get', 'put', 'delete', 'head', 'options'].includes(
      method
    );

    return {
      title: endpoint.summary || `${method.toUpperCase()} ${endpoint.path}`,
      readOnlyHint: isReadOnly,
      destructiveHint: isDestructive,
      idempotentHint: isIdempotent,
      openWorldHint: false,
    };
  }
}
