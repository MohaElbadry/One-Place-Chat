// LLM Types - All LLM-related types
// =============================================

// LLM Provider Response Types
export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// LLM Configuration Types
export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
}

// Tool Matching Types
export interface MatchResult {
  tool: any; // MCPTool type
  parameters: Record<string, any>;
  confidence: number;
  reasoning: string;
  alternativeTools?: any[]; // MCPTool[] type
}

export interface ScoredTool {
  tool: any; // MCPTool type
  score: number;
  matchDetails: {
    semanticScore: number;
    keywordScore: number;
    intentScore: number;
    pathScore: number;
  };
}

// LLM Provider Events
export interface LLMEvent {
  type: LLMEventType;
  timestamp: Date;
  payload: Record<string, any>;
}

export type LLMEventType = 
  | 'request_started'
  | 'request_completed'
  | 'request_failed'
  | 'token_usage_updated'
  | 'model_changed';
