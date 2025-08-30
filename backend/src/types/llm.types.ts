// LLM Types - Language model and AI-related types
// =============================================

// LLM Response Types
export interface LLMResponse {
  /** The generated text content */
  content: string;
  
  /** The model used for generation */
  model: string;
  
  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  
  /** Additional metadata from the LLM */
  metadata?: Record<string, any>;
}

// Tool Matching Types
export interface MatchResult {
  /** The matched tool */
  tool: any;
  
  /** Extracted parameters from user input */
  parameters: Record<string, any>;
  
  /** Confidence score (0-1) for the match */
  confidence: number;
  
  /** Reasoning for why this tool was matched */
  reasoning: string;
  
  /** Additional match metadata */
  metadata?: Record<string, any>;
}

export interface ScoredTool {
  /** The tool that was scored */
  tool: any;
  
  /** Overall similarity score (0-1) */
  score: number;
  
  /** Detailed scoring breakdown */
  matchDetails: {
    /** Semantic similarity score from embeddings */
    semanticScore: number;
    
    /** Keyword matching score */
    keywordScore: number;
    
    /** Intent matching score */
    intentScore: number;
    
    /** Path/URL matching score */
    pathScore: number;
  };
  
  /** Additional scoring metadata */
  metadata?: Record<string, any>;
}

// Embedding Types
export interface EmbeddingResult {
  /** The input text that was embedded */
  text: string;
  
  /** The generated embedding vector */
  embedding: number[];
  
  /** The model used for embedding */
  model: string;
  
  /** Token usage information */
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

// LLM Configuration Types
export interface LLMConfig {
  /** The LLM provider (e.g., 'openai', 'anthropic') */
  provider: string;
  
  /** The specific model to use */
  model: string;
  
  /** API key for authentication */
  apiKey: string;
  
  /** Base URL for the API (optional) */
  baseUrl?: string;
  
  /** Temperature for generation (0-2) */
  temperature?: number;
  
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** Additional configuration options */
  options?: Record<string, any>;
}

// Generation Request Types
export interface GenerationRequest {
  /** The prompt to generate from */
  prompt: string;
  
  /** System message (optional) */
  systemMessage?: string;
  
  /** Generation parameters */
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  
  /** Additional request metadata */
  metadata?: Record<string, any>;
}

// Generation Response Types
export interface GenerationResponse {
  /** The generated text */
  text: string;
  
  /** Generation metadata */
  metadata: {
    model: string;
    provider: string;
    timestamp: string;
    duration: number;
    tokens: number;
  };
  
  /** Additional response data */
  data?: Record<string, any>;
}
