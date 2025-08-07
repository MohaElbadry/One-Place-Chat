// Conversation Types - All conversation-related types
// =============================================

import { MCPTool } from './api.types.js';
import { ConversationId } from './common.types.js';

// Conversation Context and Messages
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

// Conversation State Management
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

// Clarification and Missing Field Types
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

// Conversation Events
export interface ConversationEvent {
  type: ConversationEventType;
  conversationId: ConversationId;
  timestamp: Date;
  payload: Record<string, any>;
}

export type ConversationEventType = 
  | 'conversation_started'
  | 'message_sent'
  | 'tool_matched'
  | 'tool_executed'
  | 'clarification_requested'
  | 'conversation_ended';
