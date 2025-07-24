import { OpenAPIV2, OpenAPIV3 } from "openapi-types";

/**
 * Supported document types for API specifications
 */
export type DocumentType = OpenAPIV2.Document | OpenAPIV3.Document;

export type DocumentChunkType =
  | "info"
  | "paths"
  | "definitions"
  | "components"
  | "security";

/**
 * Represents a chunk of a larger API document for processing
 */
export interface DocumentChunk {
  id: string;
  content: any;
  type: DocumentChunkType;
  startLine: number;
  endLine: number;
  references: string[];
}

/**
 * Information about an API endpoint extracted from the specification
 */
export interface EndpointInfo {
  path: string;
  method: string; // HTTP method (get, post, put, etc.)
  operationId: string;
  summary?: string;
  description?: string;
  parameters: any[];
  requestBody?: any;
  responses: Record<string, any>;
  security?: any[];
  tags?: string[];
}
