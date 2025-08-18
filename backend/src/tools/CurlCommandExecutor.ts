import { exec } from 'child_process';
import { promisify } from 'util';
import { MCPTool } from '../types/api.types.js';
import { CurlCommandGenerator } from './CurlCommandGenerator.js';

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
    let curlCommand = CurlCommandGenerator.generateCurlCommand(tool, parameters);
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
}
