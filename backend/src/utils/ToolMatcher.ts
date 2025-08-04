import { MCPTool } from '../types.js';
import { APIToolMatcher } from '../tools/api-tool-matcher.js';

export interface ToolMatch {
    tool: MCPTool;
    parameters: Record<string, any>;
    reasoning: string;
}

export class ToolMatcher {
    private toolMatcher: APIToolMatcher;
    private isInitialized: boolean = false;

    constructor() {
        this.toolMatcher = new APIToolMatcher(process.env.OPENAI_API_KEY);
    }

    private async ensureInitialized(tools: MCPTool[]) {
        if (!this.isInitialized && tools.length > 0) {
            await this.toolMatcher.initialize(tools);
            this.isInitialized = true;
        }
    }

    async findBestMatch(query: string, tools: MCPTool[]): Promise<{ toolMatch: ToolMatch | null; confidence: number }> {
        if (tools.length === 0) {
            return { toolMatch: null, confidence: 0 };
        }

        await this.ensureInitialized(tools);
        
        try {
            const result = await this.toolMatcher.findBestMatch(query, tools);
            if (!result) {
                return { toolMatch: null, confidence: 0 };
            }

            return {
                toolMatch: {
                    tool: result.tool,
                    parameters: result.parameters || {},
                    reasoning: result.reasoning || 'Tool matched based on your query.'
                },
                confidence: result.confidence || 0.5
            };
        } catch (error) {
            console.error('Error finding best match:', error);
            return { toolMatch: null, confidence: 0 };
        }
    }

    async findSimilarTools(query: string, limit: number = 3): Promise<Array<{ tool: MCPTool; score: number }>> {
        try {
            const tools = await this.toolMatcher.findSimilarTools(query, limit);
            return tools.map(t => ({
                tool: t.tool,
                score: t.score || 0
            }));
        } catch (error) {
            console.error('Error finding similar tools:', error);
            return [];
        }
    }

    generateCurlCommand(tool: MCPTool, params: Record<string, any>): string {
        const { method, baseUrl, path } = tool.endpoint;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

       

        // Build the URL with path parameters
        let url = `${baseUrl}${path}`;
        const pathParams = path.match(/\{([^}]+)\}/g) || [];
        
        // Process path parameters
        const processedParams = { ...params };
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
        if (['GET', 'DELETE'].includes(httpMethod)) {
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

        // Add headers
        Object.entries(headers).forEach(([key, value]) => {
            if (value) {
                // Escape single quotes in header values
                const headerValue = String(value).replace(/'/g, "'\\\''");
                curlCommand += ` \\
  -H '${key}: ${headerValue}'`;
            }
        });

        // Add body if present
        if (body) {
            // Escape single quotes in the body for the shell command
            const escapedBody = body.replace(/'/g, "'\\\''");
            curlCommand += ` \\
  -d '${escapedBody}'`;
        }

        return curlCommand;
    }
}
