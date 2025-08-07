// Common Types - Shared utilities and base interfaces
// =============================================

import { JSONSchema7 } from 'json-schema';

// Base entity interface
export interface BaseEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// HTTP and API related types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type ParameterLocation = 'query' | 'header' | 'path' | 'cookie';

// Generic API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

// Generic request configuration
export interface RequestConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Validation types
export interface FieldValidationResult {
  isValid: boolean;
  value: any;
  error?: string;
}

// Analysis types
export interface ToolRequirementsAnalysis {
  missingRequiredFields: string[];
  suggestedOptionalFields: string[];
}

// Branded types for type safety
export type ConversationId = string & { __brand: 'ConversationId' };
export type ToolName = string & { __brand: 'ToolName' };
export type UserId = string & { __brand: 'UserId' };
