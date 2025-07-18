/**
 * Types for MCP Tool generation
 */

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    title?: string;
    [key: string]: any;
  };
}

export interface MCPToolGenerationMetadata {
  totalEndpoints: number;
  processedChunks: number;
  apiInfo?: {
    title?: string;
    version?: string;
    description?: string;
  };
  processingTime: number;
}

export interface MCPToolGenerationResult {
  tools: MCPTool[];
  metadata: MCPToolGenerationMetadata;
}
