import OpenAI from "openai";
import { LLMConfig } from "../config/llm-config.js";
import { LLMResponse } from "../types/llm.types.js";

export class LLMProvider {
  private openai?: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeProvider();
  }

  private initializeProvider() {
    if (this.config.provider === "openai" && this.config.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
      });
    }
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    try {
      if (this.config.provider === "openai" && this.openai) {
        return await this.generateOpenAIResponse(prompt);
      } else {
        throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      console.error("LLM response generation failed:", error);
      throw error;
    }
  }

  /**
   * Generate streaming response using OpenAI's streaming API
   * @param messages - Optional conversation history
   */
  async generateStreamingResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
    messages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }> = [],
  ): Promise<void> {
    try {
      if (this.config.provider === "openai" && this.openai) {
        await this.generateOpenAIStreamingResponse(prompt, onChunk, messages);
      } else {
        throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      console.error("LLM streaming response generation failed:", error);
      throw error;
    }
  }

  private async generateOpenAIResponse(prompt: string): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    const completion = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 1000,
    });

    return {
      content: completion.choices[0]?.message?.content || "",
      model: this.config.model,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens:
              completion.choices[0]?.message?.content?.length || 0,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  }

  private async generateOpenAIStreamingResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
    messages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }> = [],
  ): Promise<void> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    // Prepare messages array with conversation history
    const allMessages = [
      ...messages,
      { role: "user" as const, content: prompt },
    ];

    const stream = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: allMessages,
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 1000,
      stream: true, // Enable streaming
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        onChunk(content);
      }
    }
  }

  async generateJSONResponse(prompt: string): Promise<any> {
    try {
      if (this.config.provider === "openai" && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that responds with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          temperature: this.config.temperature || 0.1,
          max_tokens: this.config.maxTokens || 1000,
        });

        const content = completion.choices[0]?.message?.content || "";
        return JSON.parse(content);
      } else {
        throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      console.error("JSON response generation failed:", error);
      throw error;
    }
  }
}
