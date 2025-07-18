/**
 * Represents an MCP (Machine-Readable API Client) Tool
 * @example
 * {
 *   name: 'getUserById',
 *   description: 'Retrieves a user by their unique identifier',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       userId: { type: 'string', description: 'The unique identifier of the user' }
 *     },
 *     required: ['userId']
 *   },
 *   annotations: {
 *     title: 'Get User by ID',
 *     readOnlyHint: true,
 *     destructiveHint: false,
 *     idempotentHint: true,
 *     openWorldHint: false
 *   }
 * }
 */
export interface MCPTool {
  /** The unique name of the tool (should be camelCase) */
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };

  annotations?: {
    title?: string; // Human-readable title for the tool
    readOnlyHint?: boolean; // If true, the tool does not modify its environment
    destructiveHint?: boolean; // If true, the tool may perform destructive updates
    idempotentHint?: boolean; // If true, repeated calls with same args have no additional effect
    openWorldHint?: boolean; // If true, tool interacts with external entities
  };
}

/**
 * Metadata about the tool generation process
 */
export interface MCPToolGenerationMetadata {
  totalEndpoints: number;
  processedChunks: number;
  apiInfo: {
    title?: string;
    version?: string;
    description?: string;
  };
  processingTime: number;
}

/**
 * Result of the tool generation process
 */
export interface MCPToolGenerationResult {
  /** Array of generated tools interfaces */
  tools: MCPTool[];
  metadata: MCPToolGenerationMetadata;
}
