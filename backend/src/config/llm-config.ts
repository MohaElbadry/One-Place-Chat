export interface LLMConfig {
  provider: 'openai';
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export function getLLMConfig(modelName: string = 'gpt-4'): LLMConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const config: LLMConfig = {
    provider: 'openai',
    model: modelName,
    apiKey: apiKey,
    temperature: 0.7,
    maxTokens: 1000,
  };

  return config;
}

export function getAvailableModels(): string[] {
  return [
    'gpt-4',
    'gpt-4-turbo-preview',
    'gpt-3.5-turbo',
  ];
} 