import { exec } from 'child_process';
import { promisify } from 'util';
import { MCPTool } from '../types.js';

const execAsync = promisify(exec);

/**
 * Executes cURL commands and handles API tool execution.
 * Provides methods for generating and executing cURL commands for API calls.
 */
export class CurlCommandExecutor {
  async executeCurl(curlCommand: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(curlCommand, { maxBuffer: 1024 * 1024 * 5 });
      
      if (stderr) {
        console.error('cURL stderr:', stderr);
      }
      
      return stdout;
    } catch (error: any) {
      console.error('cURL execution error:', error);
      throw new Error(`Failed to execute cURL command: ${error.message}`);
    }
  }

  async execute(tool: MCPTool, parameters: Record<string, any> = {}): Promise<{
    success: boolean;
    body?: any;
    error?: string;
    statusCode?: number;
  }> {
    let curlCommand = this.generateCurlCommand(tool, parameters);
    // Remove any literal \n sequences to avoid curl host parsing errors
    // Convert multi-line to single line using backslash continuations
    curlCommand = curlCommand
      .replace(/\\n/g, ' \\') // literal "\n" in string -> " \" for readability
      .replace(/[\r\n]+/g, ' \\ ');
    
    try {
      const { stdout, stderr } = await execAsync(curlCommand, { maxBuffer: 1024 * 1024 * 5 });
      
      if (stderr) {
        console.error('cURL stderr:', stderr);
      }
      
      try {
        const response = JSON.parse(stdout);
        return {
          success: true,
          body: response,
          statusCode: 200
        };
      } catch (e) {
        return {
          success: true,
          body: stdout,
          statusCode: 200
        };
      }
    } catch (error: any) {
      console.error('cURL execution error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error executing cURL command',
        statusCode: error.code || 500
      };
    }
  }

  generateCurlCommand(tool: MCPTool, parameters: Record<string, any> = {}): string {
    const { method, path, baseUrl } = tool.endpoint;
    let finalPath = path;

    // Replace path parameters
    for (const [key, value] of Object.entries(parameters)) {
      if (finalPath.includes(`{${key}}`)) {
        finalPath = finalPath.replace(`{${key}}`, encodeURIComponent(String(value)));
      }
    }

    // Build query string for GET/DELETE
    const queryParams = new URLSearchParams();
    const bodyParams: Record<string, any> = {};

    Object.entries(parameters).forEach(([key, value]) => {
      if (!path.includes(`{${key}}`)) {
        if (method === 'GET' || method === 'DELETE') {
          queryParams.append(key, String(value));
        } else {
          bodyParams[key] = value;
        }
      }
    });

    const queryString = queryParams.toString();
    const url = `${baseUrl}${finalPath}${queryString ? '?' + queryString : ''}`;

    let curl = `curl -X ${method} "${url}"`;
    curl += ' -H "Accept: application/json"';
    curl += ' -H "Content-Type: application/json"';

    // Add auth headers if needed
    if (tool.security && tool.security.length > 0) {
      // Handle basic auth or bearer tokens
      curl += ' -H "Authorization: Bearer YOUR_TOKEN"';
    }

    if (method !== 'GET' && method !== 'HEAD' && Object.keys(bodyParams).length > 0) {
      curl += ` -d '${JSON.stringify(bodyParams, null, 2)}'`;
    }

    return curl;
  }
}
