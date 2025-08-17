import OpenAI from 'openai';
import { LLMConfig } from '../config/llm-config.js';
import { LLMResponse } from '../types/llm.types.js';

export class LLMProvider {
  private openai?: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeProvider();
  }

  private initializeProvider() {
    if (this.config.provider === 'openai' && this.config.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
      });
    }
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    try {
      if (this.config.provider === 'openai' && this.openai) {
        return await this.generateOpenAIResponse(prompt);
      } else {
        throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      console.error('LLM response generation failed:', error);
      throw error;
    }
  }

  private async generateOpenAIResponse(prompt: string): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const completion = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 1000,
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      model: this.config.model,
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      } : undefined,
    };
  }

  async generateJSONResponse(prompt: string): Promise<any> {
    try {
      if (this.config.provider === 'openai' && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that responds with valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: this.config.temperature || 0.1,
          max_tokens: this.config.maxTokens || 1000,
        });

        const content = completion.choices[0]?.message?.content || '';
        return JSON.parse(content);
      } else {
        throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      console.error('JSON response generation failed:', error);
      throw error;
    }
  }
} 