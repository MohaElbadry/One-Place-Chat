import { JSONSchema7 } from 'json-schema';
import { OpenAPIV3 } from 'openapi-types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type ParameterLocation = 'query' | 'header' | 'path' | 'cookie';

// Core MCP Tool Types
export interface MCPTool {
  /** Unique identifier for the tool */
  name: string;
  
  /** Human-readable description of what the tool does */
  description: string;
  
  /** JSON Schema defining the input parameters */
  inputSchema: JSONSchema7;
  
  /** Additional metadata and hints about the tool */
  annotations: {
    /** HTTP method used by the tool */
    method: HttpMethod;
    
    /** Path of the API endpoint */
    path: string;
    
    /** Tags for categorization */
    tags?: string[];
    
    /** Whether the tool is deprecated */
    deprecated: boolean;
    
    /** Display title */
    title: string;
    
    /** Whether the tool can handle arbitrary data */
    openWorldHint: boolean;
    
    /** Whether the tool is read-only */
    readOnlyHint: boolean;
  };
  
  /** Endpoint information */
  endpoint: {
    method: HttpMethod;
    path: string;
    baseUrl: string;
  };
  
  /** Security requirements */
  security: Array<Record<string, string[]>>;
  
  /** Function to execute the tool */
  execute: (params: any) => Promise<any>;
}

// OpenAPI Types
export interface OpenAPIParameter extends Omit<OpenAPIV3.ParameterObject, 'in' | 'schema' | 'items'> {
  in?: ParameterLocation;
  schema?: JSONSchema7;
  items?: JSONSchema7 | { $ref: string };
  type?: string;
  format?: string;
  enum?: any[];
  default?: any;
  deprecated?: boolean;
}

export interface OpenAPIOperation extends Omit<OpenAPIV3.OperationObject, 'parameters'> {
  parameters?: (OpenAPIParameter | OpenAPIV3.ReferenceObject)[];
  requestBody?: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject;
  responses: OpenAPIV3.ResponsesObject;
}
