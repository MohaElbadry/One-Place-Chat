import { DocumentChunk, EndpointInfo, HttpMethod } from '../../types/document.types';
import { MCPTool } from '../../types/mcp-tool.types';

/**
 * Processes API endpoints to extract relevant information
 */
export class EndpointProcessor {
  /**
   * Processes a document chunk to extract endpoint information
   */
  public processChunk(chunk: DocumentChunk, fullDocument: any): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];

    if (chunk.type === 'paths') {
      for (const [path, methods] of Object.entries(chunk.content as Record<string, any>)) {
        for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
          if (this.isValidHttpMethod(method)) {
            const endpoint = this.extractEndpointInfo(
              path,
              method,
              operation,
              fullDocument
            );
            if (endpoint) endpoints.push(endpoint);
          }
        }
      }
    }

    return endpoints;
  }

  /**
   * Extracts relevant information from an API endpoint definition
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
      method: method as HttpMethod,
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      parameters: operation.parameters || [],
      requestBody: operation.requestBody,
      responses: operation.responses || {},
      security: operation.security,
      tags: operation.tags,
    };
  }

  /**
   * Validates if a string is a valid HTTP method
   */
  private isValidHttpMethod(
    method: string
  ): method is HttpMethod {
    return [
      'get', 'post', 'put', 'delete', 'patch', 'options', 'head'
    ].includes(method.toLowerCase());
  }
}
