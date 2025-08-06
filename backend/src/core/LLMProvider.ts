import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { LLMConfig } from '../config/llm-config.js';
import { LLMResponse } from '../types.js';

/**
 * Multi-provider LLM client supporting OpenAI, Anthropic, and Ollama.
 * Provides unified interface for different LLM providers.
 */
export class LLMProvider {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeProvider();
  }

  private initializeProvider() {
    switch (this.config.provider) {
      case 'openai':
        this.openai = new OpenAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseUrl
        });
        break;
      case 'anthropic':
        this.anthropic = new Anthropic({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseUrl
        });
        break;
      case 'ollama':
        // Ollama uses OpenAI-compatible API
        this.openai = new OpenAI({
          apiKey: 'ollama', // Dummy key for Ollama
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1'
        });
        break;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'openai':
      case 'ollama':
        return await this.generateOpenAIResponse(prompt);
      case 'anthropic':
        return await this.generateAnthropicResponse(prompt);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async generateOpenAIResponse(prompt: string): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.temperature || 0.1,
      max_tokens: this.config.maxTokens || 1000
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No response content received');
    }

    return {
      content: choice.message.content,
      model: this.config.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined
    };
  }

  private async generateAnthropicResponse(prompt: string): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 1000,
      temperature: this.config.temperature || 0.1,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('No text response received');
    }

    return {
      content: content.text,
      model: this.config.model,
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      } : undefined
    };
  }

  async generateJSONResponse(prompt: string): Promise<any> {
    const response = await this.generateResponse(prompt);
    
    try {
      return JSON.parse(response.content);
    } catch (error) {
      console.error('Failed to parse JSON response:', response.content);
      throw new Error('Invalid JSON response from LLM');
    }
  }
} 