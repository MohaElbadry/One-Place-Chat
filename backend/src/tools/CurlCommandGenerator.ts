import { MCPTool } from '../types/api.types.js';

/**
 * Centralized cURL command generator to eliminate duplicate code
 * This class handles all cURL command generation logic in one place
 */
export class CurlCommandGenerator {
  /**
   * Generate a cURL command for a tool with the given parameters
   */
  static generateCurlCommand(tool: MCPTool, params: Record<string, any>): string {
    const { method, baseUrl, path } = tool.endpoint;
    
    // Only include parameters defined in the tool's inputSchema
    const allowedParams = tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties) : [];
    const filteredParams: Record<string, any> = {};
    
    for (const key of allowedParams) {
      if (params[key] !== undefined) {
        filteredParams[key] = params[key];
      }
    }

    // Build the URL with path parameters
    let url = `${baseUrl}${path}`;
    const pathParams = path.match(/\{([^}]+)\}/g) || [];
    
    // Process path parameters
    const processedParams = { ...filteredParams };
    pathParams.forEach(param => {
      const paramName = param.slice(1, -1);
      if (processedParams[paramName] !== undefined) {
        url = url.replace(param, encodeURIComponent(String(processedParams[paramName])));
        delete processedParams[paramName];
      }
    });

    // Process query parameters and request body
    let queryString = '';
    let body = '';
    const httpMethod = method.toUpperCase();
    
    // For GET/DELETE, add remaining parameters to query string
    if (["GET", "DELETE"].includes(httpMethod)) {
      const queryParams = new URLSearchParams();
      Object.entries(processedParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, String(value));
        }
      });
      queryString = queryParams.toString();
    } else {
      // For other methods, add remaining parameters to request body
      const bodyParams: Record<string, any> = {};
      Object.entries(processedParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          bodyParams[key] = value;
        }
      });
      if (Object.keys(bodyParams).length > 0) {
        body = JSON.stringify(bodyParams, null, 2);
      }
    }

    // Add query string to URL if present
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    // Build the curl command
    let curlCommand = `curl -X ${httpMethod} "${url}"`;
    curlCommand += ' -H "Content-Type: application/json"';
    curlCommand += ' -H "Accept: application/json"';
    
    // Add auth headers if needed
    if (tool.security && tool.security.length > 0) {
      curlCommand += this.generateAuthHeaders(tool.security);
    }

    if (body) {
      curlCommand += ` -d '${body}'`;
    }
    
    return curlCommand;
  }

  /**
   * Generate authentication headers based on security requirements
   */
  private static generateAuthHeaders(security: Array<Record<string, string[]>>): string {
    // For now, return a placeholder - this should be enhanced based on actual security schemes
    return ' -H "Authorization: Bearer YOUR_TOKEN"';
  }

  /**
   * Validate and sanitize parameters for cURL generation
   */
  static sanitizeParameters(parameters: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const placeholderValues = ['Unknown', 'unknown', '', 'N/A', 'n/a', 'TBD', 'tbd'];

    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && !placeholderValues.includes(value)) {
          sanitized[key] = value;
        } else if (Array.isArray(value)) {
          const filteredArray = value.filter(v => !placeholderValues.includes(v));
          if (filteredArray.length > 0) {
            sanitized[key] = filteredArray;
          }
        } else if (typeof value !== 'string') {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  /**
   * Check if parameters contain placeholder values
   */
  static hasPlaceholderValues(parameters: Record<string, any>): boolean {
    return Object.values(parameters).some(value => this.isPlaceholderValue(value));
  }

  /**
   * Check if a value is a placeholder
   */
  static isPlaceholderValue(value: any): boolean {
    if (typeof value === 'string') {
      return value.trim().toLowerCase() === 'string' || value.trim() === '';
    }
    return value === undefined || value === null;
  }
}
