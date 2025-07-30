import { MCPTool } from '../types.js';
import OpenAI from 'openai';

export interface MatchResult {
  tool: MCPTool;
  parameters: Record<string, any>;
  confidence: number;
  reasoning: string;
}

export class AdvancedAPIToolMatcher {
  private openai: OpenAI;
  private tools: MCPTool[] = [];
  private isInitialized: boolean = false;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async initialize(tools: MCPTool[]): Promise<void> {
    if (!tools?.length) {
        throw new Error('No tools provided for initialization');
    }
    this.tools = tools.filter(tool => 
        tool?.name && 
        tool?.endpoint && 
        tool.endpoint.method && 
        tool.endpoint.path
    );
    this.isInitialized = true;
}

  async findBestMatch(message: string): Promise<MatchResult | null> {
    if (!this.isInitialized || this.tools.length === 0) {
      throw new Error('Tool matcher not initialized with tools');
    }

    try {
      // Convert tools to function calling format
      const functions = this.tools.map(tool => ({
        name: tool.name,
        description: this.getToolDescription(tool),
        parameters: {
          type: 'object',
          properties: tool.inputSchema?.properties || {},
          required: tool.inputSchema?.required || []
        }
      }));

      // Get tool selection and parameters from LLM
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{
          role: 'system',
          content: 'You are an API assistant. Match the user request to the most appropriate tool and extract parameters.'
        }, {
          role: 'user',
          content: message
        }],
        functions,
        function_call: 'auto',
        temperature: 0.1
      });

      const functionCall = response.choices[0].message.function_call;
      if (!functionCall) {
        return {
          tool: this.tools[0], // Fallback to first tool
          parameters: {},
          confidence: 0.3,
          reasoning: 'No specific tool matched, using fallback'
        };
      }

      const matchedTool = this.tools.find(t => t.name === functionCall.name);
      if (!matchedTool) {
        throw new Error('Matched tool not found in available tools');
      }

      return {
        tool: matchedTool,
        parameters: JSON.parse(functionCall.arguments || '{}'),
        confidence: 0.9,
        reasoning: 'Matched using LLM function calling'
      };

    } catch (error) {
      console.error('Error in tool matching:', error);
      // Fallback to simple matching if LLM fails
      return this.fallbackMatch(message);
    }
  }

  private getToolDescription(tool: MCPTool): string {
    const parts = [
        tool.name,
        tool.description,
        tool.endpoint?.method && tool.endpoint?.path 
            ? `Endpoint: ${tool.endpoint.method} ${tool.endpoint.path}`
            : null,
        tool.inputSchema?.description
    ].filter(Boolean);

    return parts.join('\n') || 'No description available';
}

  private async fallbackMatch(message: string): Promise<MatchResult> {
    if (!this.tools?.length) {
        throw new Error('No tools available for matching');
    }

    const messageLower = message.toLowerCase();
    const matchedTool = this.tools.find(tool => {
        if (!tool?.name) return false;
        
        const nameMatch = tool.name.toLowerCase().includes(messageLower);
        const descMatch = tool.description?.toLowerCase().includes(messageLower);
        const pathMatch = tool.endpoint?.path?.toLowerCase().includes(messageLower);
        
        return nameMatch || descMatch || pathMatch;
    }) || this.tools[0];

    return {
        tool: matchedTool,
        parameters: {},
        confidence: 0.5,
        reasoning: 'Fallback match using keyword search'
    };
}

async findSimilarTools(query: string, limit: number = 3): Promise<Array<{tool: MCPTool, score: number}>> {
  if (!query?.trim() || !this.tools?.length) {
      return [];
  }

  const queryLower = query.toLowerCase();
  return this.tools
      .map(tool => ({
          tool,
          score: this.calculateMatchScore(tool, queryLower)
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
}

  private calculateMatchScore(tool: MCPTool, query: string): number {
    if (!tool?.endpoint?.path) return 0;
    const toolText = [
      tool.name,
      tool.description,
      tool.endpoint.path,
      tool.endpoint.method
    ].join(' ').toLowerCase();

    const queryTerms = query.split(/\s+/);
    const matches = queryTerms.filter(term => 
      term.length > 2 && toolText.includes(term)
    ).length;

    return matches / queryTerms.length;
  }
}