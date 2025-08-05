export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export const LLM_CONFIGS: Record<string, LLMConfig> = {
  'gpt-4': {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 1000
  },
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    temperature: 0.1,
    maxTokens: 1000
  },
  'claude-3-sonnet': {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    temperature: 0.1,
    maxTokens: 1000
  },
  'claude-3-opus': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    temperature: 0.1,
    maxTokens: 1000
  },
  'o3': {
    provider: 'ollama',
    model: 'o3',
    temperature: 0.1,
    maxTokens: 1000
  }
};

export function getLLMConfig(modelName: string = 'gpt-4'): LLMConfig {
  const config = LLM_CONFIGS[modelName];
  if (!config) {
    throw new Error(`Unknown model: ${modelName}`);
  }
  
  // Set API keys from environment variables
  if (config.provider === 'openai') {
    config.apiKey = process.env.OPENAI_API_KEY;
  } else if (config.provider === 'anthropic') {
    config.apiKey = process.env.ANTHROPIC_API_KEY;
  }
  
  return config;
}

export function getAvailableModels(): string[] {
  return Object.keys(LLM_CONFIGS);
} 