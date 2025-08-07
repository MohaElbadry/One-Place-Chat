// API Types - API-related types including MCP tools and OpenAPI
// =============================================

import { JSONSchema7 } from 'json-schema';
import { OpenAPIV3 } from 'openapi-types';
import { HttpMethod, ParameterLocation } from './common.types.js';

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
    parameters?: Array<{
      name: string;
      in: 'query' | 'path' | 'header' | 'body';
      required: boolean;
      description: string;
      type: string;
    }>;
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

// Tool Definition Types (for server)
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  endpoint: {
    method: string;
    path: string;
    baseUrl: string;
  };
  annotations: {
    method: string;
    path: string;
    tags?: string[];
    deprecated?: boolean;
    title?: string;
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
  };
  security?: any[];
  execute: (params: any) => Promise<any>;
}

// MCP Response Types
export interface MCPResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  content?: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

// Generic API endpoint type
export type ApiEndpoint<TRequest = any, TResponse = any> = {
  request: TRequest;
  response: TResponse;
};
