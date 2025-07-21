/**
 * Type definitions for API document processing
 */

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

export interface DocumentChunk {
  id: string;
  content: any;
  type: 'paths' | 'components' | 'definitions' | 'security' | 'info';
  startLine: number;
  endLine: number;
  references: string[];
}

export interface EndpointInfo {
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: any[];
  requestBody?: any;
  responses: Record<string, any>;
  security?: any[];
  tags?: string[];
}

export interface DocumentValidationResult {
  valid: boolean;
  error?: string;
}

export interface DocumentProcessorOptions {
  /** Maximum size of each chunk when processing large documents */
  maxChunkSize?: number;
  
  /** Number of lines to overlap between chunks */
  chunkOverlap?: number;
}

export interface DocumentLoader {
  load(documentPath: string): Promise<any>;
  isUrl(path: string): boolean;
}

export interface DocumentValidator {
  validate(document: any): DocumentValidationResult;
}

export interface DocumentChunker {
  chunk(document: any): DocumentChunk[];
}
