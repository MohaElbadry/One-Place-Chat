import { JSONSchema7 } from 'json-schema';

export interface MCPTool {
  /** Unique identifier for the tool */
  name: string;
  
  /** Human-readable description of what the tool does */
  description: string;
  
  /** JSON Schema defining the input parameters */
  inputSchema: JSONSchema7 & {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  
  /** Additional metadata and hints about the tool */
  annotations: {
    /** Title to display for the tool */
    title: string;
    
    /** Whether the tool is read-only */
    readOnlyHint: boolean;
    
    /** Whether the tool performs destructive operations */
    destructiveHint: boolean;
    
    /** Whether the tool is idempotent */
    idempotentHint: boolean;
    
    /** Whether the tool can handle arbitrary inputs */
    openWorldHint: boolean;
  };
  
  /** Parameters for the tool */
  parameters: Record<string, any>;
  
  /** Function to execute the tool */
  execute: (args: any) => Promise<any>;
}
