import { MCPTool } from '../types.js';
import { AdvancedAPIToolMatcher } from './advanced-api-tool-matcher.js';

export interface MatchResult {
  tool: MCPTool;
  parameters: Record<string, any>;
  confidence: number;
  reasoning: string;
}

export class APIToolMatcher {
  private advancedMatcher: AdvancedAPIToolMatcher;
  private toolsCache: Map<string, MCPTool[]> = new Map();
  private isInitialized = false;

  constructor(openAIApiKey?: string) {
    // Initialize with OpenAI API key
    this.advancedMatcher = new AdvancedAPIToolMatcher(openAIApiKey || '');
  }

  generateCurlCommand(tool: MCPTool, parameters: Record<string, any> = {}): string {
    const { method, baseUrl, path } = tool.endpoint;
    let url = `${baseUrl}${path}`;
    
    // Replace path parameters
    for (const [key, value] of Object.entries(parameters)) {
      if (url.includes(`{${key}}`)) {
        url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
        // Remove the parameter as it's been used in the path
        delete parameters[key];
      }
    }

    // Add query parameters
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    // Build the curl command
    const headers = {
      'Content-Type': 'application/json',
      ...(parameters.headers || {})
    };

    let curlCommand = `curl -X ${method.toUpperCase()} "${url}"`;

    // Add headers
    for (const [key, value] of Object.entries(headers)) {
      if (value) {
        curlCommand += ` \\
  -H "${key}: ${value}"`;
      }
    }

    // Add body for POST, PUT, PATCH
    const bodyParams = { ...parameters };
    delete bodyParams.headers;
    
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(bodyParams).length > 0) {
      curlCommand += ` \\
  -d '${JSON.stringify(bodyParams, null, 2)}'`;
    }

    return curlCommand;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity implementation
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private getToolSearchText(tool: MCPTool): string {
    return [
      tool.name || '',
      tool.description || '',
      tool.endpoint?.path?.replace(/[\{\}]/g, '') || '',
      tool.endpoint?.method || ''
    ].join(' ').toLowerCase();
  }

  private async initializeTools(tools: MCPTool[]): Promise<void> {
    if (!this.isInitialized) {
      await this.advancedMatcher.initialize(tools);
      this.isInitialized = true;
    }
  }

  async findBestMatch(message: string, tools: MCPTool[]): Promise<MatchResult | null> {
    if (!message?.trim()) return null;
    
    try {
      // Initialize the advanced matcher if not already done
      if (!this.isInitialized) {
        await this.advancedMatcher.initialize(tools);
        this.isInitialized = true;
      }
      
      // Use the advanced matcher for better results
      return await this.advancedMatcher.findBestMatch(message);
    } catch (error) {
      console.error('Error in findBestMatch:', error);
      return null;
    }
  }

  async findSimilarTools(query: string, limit: number = 3): Promise<Array<{tool: MCPTool, score: number}>> {
    if (!query?.trim()) return [];
    
    try {
      // Use the advanced matcher's similarity search if available
      if (this.advancedMatcher && typeof this.advancedMatcher.findSimilarTools === 'function') {
        return await this.advancedMatcher.findSimilarTools(query, limit);
      }
      
      // Fallback to simple implementation
      const normalizedQuery = query.trim().toLowerCase();
      const allTools: MCPTool[] = [];
      this.toolsCache.forEach(tools => allTools.push(...tools));
      
      return allTools
        .filter((tool): tool is MCPTool => Boolean(tool))
        .map(tool => ({
          tool,
          score: this.calculateStringSimilarity(normalizedQuery, this.getToolSearchText(tool))
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .filter(item => item.score > 0.1);
    } catch (error) {
      console.error('Error in findSimilarTools:', error);
      return [];
    }
  }

  // Group tools by their endpoint path for better organization
  private groupToolsByEndpoint(tools: MCPTool[]): Map<string, MCPTool[]> {
    const groups = new Map<string, MCPTool[]>();
    tools.forEach(tool => {
      const pathParts = tool.endpoint.path.split('/').filter((p: string) => p && !p.startsWith('{'));
      const resource = pathParts[0] || 'general';
      
      if (!groups.has(resource)) {
        groups.set(resource, []);
      }
      
      const toolGroup = groups.get(resource);
      if (toolGroup) {
        toolGroup.push(tool);
      }
    });
    return groups;
  }
}

export class HTTPBinToolMatcher extends APIToolMatcher {
  async matchHTTPBinIntent(message: string, tools: MCPTool[]): Promise<MatchResult | null> {
    const patterns = {
      auth: /auth|login|authenticate|credentials/i,
      status: /status|code|response/i,
      headers: /header|request.*info/i,
      data: /post|send|submit|data/i,
      delete: /delete|remove/i,
      get: /get|fetch|retrieve|show/i
    };

    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) {
        const categoryTools = tools.filter(t => 
          t.endpoint.path.includes(category) || 
          t.name.toLowerCase().includes(category)
        );
        if (categoryTools.length > 0) {
          return this.findBestMatch(message, categoryTools);
        }
      }
    }
    return super.findBestMatch(message, tools);
  }
}
