// Re-export all types from domain files
export * from './common.types.js';
export * from './api.types.js';
export * from './conversation.types.js';
export * from './llm.types.js';

// Legacy exports for backward compatibility
// These will be removed once all imports are updated
export type {
  HttpMethod,
  ParameterLocation,
  ApiResponse,
  RequestConfig,
  Optional,
  RequiredFields,
  DeepPartial,
  FieldValidationResult,
  ToolRequirementsAnalysis,
  ConversationId,
  ToolName,
  UserId
} from './common.types.js';

export type {
  MCPTool,
  OpenAPIParameter,
  OpenAPIOperation,
  ToolDefinition,
  MCPResponse,
  ApiEndpoint
} from './api.types.js';

export type {
  ConversationContext,
  ConversationMessage,
  ConversationState,
  EnhancedChatResponse,
  MissingField,
  ClarificationRequest,
  ConversationEvent,
  ConversationEventType
} from './conversation.types.js';

export type {
  LLMResponse,
  LLMConfig,
  MatchResult,
  ScoredTool,
  LLMEvent,
  LLMEventType
} from './llm.types.js';
