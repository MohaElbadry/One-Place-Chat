/**
 * Types for document processing in the MCP Tool Generator
 */

export type DocumentType = {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  paths?: Record<string, any>;
  [key: string]: any;
};

export type DocumentChunkType = 'paths' | 'definitions' | 'components' | 'security' | 'tags' | 'other';

export interface DocumentChunk {
  id: string;
  content: any;
  type: DocumentChunkType;
  startLine: number;
  endLine: number;
  references: string[];
}

export interface EndpointInfo {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: Record<string, any>;
  security?: any[];
  tags?: string[];
}
