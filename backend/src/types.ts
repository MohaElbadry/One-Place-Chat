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

export interface ConversationContext {
  id: string;
  messages: ConversationMessage[];
  metadata: {
    startTime: Date;
    lastActivity: Date;
    userPreferences?: Record<string, any>;
    extractedInfo?: Record<string, any>;
  };
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    toolUsed?: string;
    parameters?: Record<string, any>;
    confidence?: number;
    needsClarification?: boolean;
    missingInfo?: string[];
  };
}

export interface MissingInfoAnalysis {
  hasMissingInfo: boolean;
  missingFields: MissingField[];
  confidence: number;
  suggestedQuestions: string[];
}

export interface MissingField {
  name: string;
  description: string;
  type: 'required' | 'optional';
  possibleValues?: string[];
  examples?: string[];
}

export interface ClarificationRequest {
  type: 'missing_required' | 'ambiguous_intent' | 'parameter_validation' | 'confirmation';
  message: string;
  fields: MissingField[];
  context?: Record<string, any>;
}

export interface ConversationState {
  currentTool?: MCPTool;
  collectedParameters: Record<string, any>;
  missingRequiredFields: string[];
  suggestedOptionalFields: string[];
  conversationContext: string[];
  lastActivity: Date;
}

// Enhanced Chat Response Types
export interface EnhancedChatResponse {
  message: string;
  needsClarification: boolean;
  clarificationRequest?: {
    type: 'missing_required' | 'suggest_optional' | 'confirmation';
    message: string;
    missingFields: Array<{
      name: string;
      description: string;
      type: 'required' | 'optional';
      possibleValues?: string[];
      examples?: string[];
    }>;
    suggestedFields?: Array<{
      name: string;
      description: string;
      reason: string;
    }>;
  };
  toolMatch?: {
    tool: MCPTool;
    confidence: number;
    parameters: Record<string, any>;
  };
  executionResult?: any;
  conversationId: string;
}

// LLM Provider Types
export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Tool Matching Types
export interface MatchResult {
  tool: MCPTool;
  parameters: Record<string, any>;
  confidence: number;
  reasoning: string;
  alternativeTools?: MCPTool[];
}

export interface ScoredTool {
  tool: MCPTool;
  score: number;
  matchDetails: {
    semanticScore: number;
    keywordScore: number;
    intentScore: number;
    pathScore: number;
  };
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

// Analysis Types
export interface ToolRequirementsAnalysis {
  missingRequiredFields: string[];
  suggestedOptionalFields: string[];
}

// Validation Types
export interface FieldValidationResult {
  isValid: boolean;
  value: any;
  error?: string;
}
