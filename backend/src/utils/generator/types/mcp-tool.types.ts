/**
 * Type definitions for MCP Tools
 */

export interface MCPTool {
  /** Unique identifier for the tool */
  name: string;
  
  /** Human-readable description of what the tool does */
  description?: string;
  
  /** JSON Schema defining the input parameters */
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  
  /** Additional metadata and hints about the tool */
  annotations?: {
    /** Title to display for the tool */
    title?: string;
    
    /** Whether the tool is read-only */
    readOnlyHint?: boolean;
    
    /** Whether the tool performs destructive operations */
    destructiveHint?: boolean;
    
    /** Whether the tool is idempotent */
    idempotentHint?: boolean;
    
    /** Whether the tool can handle arbitrary inputs */
    openWorldHint?: boolean;
  };
}

export interface MCPToolGenerationResult {
  /** Generated tools */
  tools: MCPTool[];
  
  /** Metadata about the generation process */
  metadata: {
    /** Total number of endpoints processed */
    totalEndpoints: number;
    
    /** Number of document chunks processed */
    processedChunks: number;
    
    /** Information about the API */
    apiInfo: {
      title?: string;
      version?: string;
      description?: string;
    };
    
    /** Time taken to generate the tools in milliseconds */
    processingTime: number;
  };
}
