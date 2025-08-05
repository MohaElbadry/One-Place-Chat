// Enhanced ConversationalChatEngine with better parameter handling
import { ConversationManager } from './ConversationManager.js';
import { GenericMissingInfoDetector as EnhancedMissingInfoDetector } from './MissingInfoDetector.js';
import { APIToolMatcher } from '../tools/api-tool-matcher.js';
import { CurlExecutor } from '../tools/executor.js';
import { MCPTool } from '../types.js';
import { ConversationContext, ConversationState, ClarificationRequest, MissingInfoAnalysis } from '../types.js';
import OpenAI from 'openai';

export interface ChatResponse {
  message: string;
  needsClarification: boolean;
  clarificationRequest?: ClarificationRequest;
  toolMatch?: {
    tool: MCPTool;
    confidence: number;
    parameters: Record<string, any>;
  };
  suggestions?: string[];
  executionResult?: any;
}

export class EnhancedConversationalChatEngine {
  private conversationManager: ConversationManager;
  private missingInfoDetector: EnhancedMissingInfoDetector;
  private toolMatcher: APIToolMatcher;
  private executor: CurlExecutor;
  private openai: OpenAI;
  private tools: MCPTool[] = [];

  constructor(tools: MCPTool[] = []) {
    this.conversationManager = new ConversationManager();
    this.missingInfoDetector = new EnhancedMissingInfoDetector();
    this.toolMatcher = new APIToolMatcher();
    this.executor = new CurlExecutor();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.tools = tools;
  }

  startConversation(): string {
    const context = this.conversationManager.createConversation();
    
    this.conversationManager.addMessage(
      context.id,
      'assistant',
      'Hello! I\'m here to help you interact with various APIs. Just tell me what you want to do in natural language! 🚀'
    );

    return context.id;
  }

  async processMessage(conversationId: string, userInput: string): Promise<ChatResponse> {
    this.conversationManager.addMessage(conversationId, 'user', userInput);
    
    const state = this.conversationManager.getConversationState(conversationId);
    if (!state) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (state.isAwaitingInput && state.clarificationRequest) {
      return await this.handleClarificationResponse(conversationId, userInput, state);
    }

    return await this.processNewRequest(conversationId, userInput);
  }

  private async handleClarificationResponse(
    conversationId: string,
    userInput: string,
    state: ConversationState
  ): Promise<ChatResponse> {
    if (!state.clarificationRequest || !state.pendingTool) {
      throw new Error('Invalid state for clarification response');
    }

    const clarificationRequest = state.clarificationRequest;
    const tool = state.pendingTool;

    // Parse user's response to clarification
    const responses = this.parseClarificationResponse(userInput, clarificationRequest.fields);
    
    // Validate responses
    const validationResults = this.validateClarificationResponses(responses, clarificationRequest.fields);
    const hasErrors = validationResults.some(r => !r.isValid);

    if (hasErrors) {
      const errorMessages = validationResults
        .filter(r => !r.isValid)
        .map(r => r.error)
        .join('\n');

      const response: ChatResponse = {
        message: `I found some issues with your response:\n\n${errorMessages}\n\nPlease try again.`,
        needsClarification: true,
        clarificationRequest
      };

      this.conversationManager.addMessage(conversationId, 'assistant', response.message);
      return response;
    }

    // All validations passed, update extracted info
    const newInfo: Record<string, any> = {};
    validationResults.forEach((result, index) => {
      if (result.isValid && result.value) {
        newInfo[clarificationRequest.fields[index].name] = result.value;
      }
    });

    // Merge with existing provided info from context
    const contextProvidedInfo = clarificationRequest.context?.providedInfo || {};
    const updatedExtractedInfo = { ...state.extractedInfo, ...contextProvidedInfo, ...newInfo };
    
    this.conversationManager.updateConversationState(conversationId, {
      extractedInfo: updatedExtractedInfo,
      isAwaitingInput: false,
      clarificationRequest: undefined
    });

    // Check if we now have enough information
    const conversationHistory = this.conversationManager.getConversationSummary(conversationId);
    const missingInfoAnalysis = await this.missingInfoDetector.analyzeForMissingInfo(
      clarificationRequest.context?.originalInput || '',
      tool,
      conversationHistory,
      updatedExtractedInfo
    );

    if (missingInfoAnalysis.hasMissingInfo) {
      // Still missing information
      const newClarificationRequest = await this.missingInfoDetector.createClarificationRequest(
        missingInfoAnalysis,
        tool,
        clarificationRequest.context?.originalInput || '',
        updatedExtractedInfo
      );

      this.conversationManager.updateConversationState(conversationId, {
        isAwaitingInput: true,
        clarificationRequest: newClarificationRequest
      });

      const response: ChatResponse = {
        message: newClarificationRequest.message,
        needsClarification: true,
        clarificationRequest: newClarificationRequest
      };

      this.conversationManager.addMessage(conversationId, 'assistant', response.message);
      return response;
    }

    // We have all the information needed, proceed with execution
    return await this.executeToolWithInfo(conversationId, tool, updatedExtractedInfo);
  }

  private async processNewRequest(conversationId: string, userInput: string): Promise<ChatResponse> {
    const conversationHistory = this.conversationManager.getConversationSummary(conversationId);
    const contextExtractedInfo = this.conversationManager.extractInformationFromHistory(conversationId);

    // Find the best matching tool
    const toolMatch = await this.toolMatcher.findBestMatch(userInput, this.tools);
    
    if (!toolMatch) {
      const response: ChatResponse = {
        message: "I couldn't find a suitable API for your request. Could you please rephrase or provide more details about what you'd like to do?",
        needsClarification: false,
        suggestions: await this.generateSuggestions(userInput)
      };

      this.conversationManager.addMessage(conversationId, 'assistant', response.message);
      return response;
    }

    // Analyze for missing information with enhanced detector
    const missingInfoAnalysis = await this.missingInfoDetector.analyzeForMissingInfo(
      userInput,
      toolMatch.tool,
      conversationHistory,
      { ...contextExtractedInfo, ...toolMatch.parameters }
    );

    // Combine all extracted info
    const allExtractedInfo = { 
      ...contextExtractedInfo, 
      ...toolMatch.parameters 
    };

    if (missingInfoAnalysis.hasMissingInfo) {
      // Create enhanced clarification request that shows what we already have
      const clarificationRequest = await this.missingInfoDetector.createClarificationRequest(
        missingInfoAnalysis,
        toolMatch.tool,
        userInput,
        allExtractedInfo
      );

      // Update conversation state
      this.conversationManager.updateConversationState(conversationId, {
        isAwaitingInput: true,
        pendingTool: toolMatch.tool,
        pendingParameters: toolMatch.parameters,
        clarificationRequest,
        extractedInfo: allExtractedInfo
      });

      const response: ChatResponse = {
        message: clarificationRequest.message,
        needsClarification: true,
        clarificationRequest,
        toolMatch: {
          tool: toolMatch.tool,
          confidence: toolMatch.confidence,
          parameters: allExtractedInfo
        }
      };

      this.conversationManager.addMessage(conversationId, 'assistant', response.message, {
        needsClarification: true,
        missingInfo: missingInfoAnalysis.missingFields.map(f => f.name)
      });

      return response;
    }

    // No missing information, proceed with execution
    return await this.executeToolWithInfo(conversationId, toolMatch.tool, allExtractedInfo);
  }

  private async executeToolWithInfo(
    conversationId: string,
    tool: MCPTool,
    parameters: Record<string, any>
  ): Promise<ChatResponse> {
    try {
      // Show summary before execution
      const summaryMessage = this.generateExecutionSummary(tool, parameters);
      
      // Generate and execute cURL command
      const curlCommand = this.toolMatcher.generateCurlCommand(tool, parameters);
      const executionResult = await this.executor.executeCurl(curlCommand);
      
      let resultMessage = `${summaryMessage}\n\n✅ **API call executed successfully!**\n\n`;
      
      try {
        const jsonResult = JSON.parse(executionResult);
        resultMessage += `**Response:**\n\`\`\`json\n${JSON.stringify(jsonResult, null, 2)}\n\`\`\``;
      } catch {
        resultMessage += `**Response:**\n\`\`\`\n${executionResult}\n\`\`\``;
      }

      resultMessage += `\n\nAnything else you'd like to do? 🎯`;

      const response: ChatResponse = {
        message: resultMessage,
        needsClarification: false,
        executionResult: executionResult,
        toolMatch: {
          tool,
          confidence: 1.0,
          parameters
        }
      };

      this.conversationManager.addMessage(conversationId, 'assistant', response.message, {
        toolUsed: tool.name,
        parameters,
        confidence: 1.0
      });

      // Reset conversation state
      this.conversationManager.updateConversationState(conversationId, {
        isAwaitingInput: false,
        pendingTool: undefined,
        pendingParameters: undefined,
        clarificationRequest: undefined,
        extractedInfo: {}
      });

      return response;

    } catch (error: any) {
      const errorMessage = `❌ **Error executing API call:**\n\n${error.message}\n\nWould you like to try again or do something else?`;
      
      const response: ChatResponse = {
        message: errorMessage,
        needsClarification: false
      };

      this.conversationManager.addMessage(conversationId, 'assistant', response.message);
      return response;
    }
  }

  private generateExecutionSummary(tool: MCPTool, parameters: Record<string, any>): string {
    const requiredParams = Object.entries(parameters)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `- **${key}**: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join('\n');

    return `🚀 **Executing ${tool.name}**\n${tool.description}\n\n**Parameters:**\n${requiredParams}`;
  }

  private parseClarificationResponse(userInput: string, fields: any[]): Record<string, string> {
    const responses: Record<string, string> = {};
    
    if (fields.length === 1) {
      responses[fields[0].name] = userInput.trim();
    } else {
      const lines = userInput.split('\n').map(line => line.trim()).filter(line => line);
      
      for (let i = 0; i < Math.min(lines.length, fields.length); i++) {
        const line = lines[i];
        const fieldName = fields[i].name;
        const cleanedValue = line.replace(/^\d+\.\s*/, '').trim();
        responses[fieldName] = cleanedValue;
      }
    }

    return responses;
  }

  private validateClarificationResponses(responses: Record<string, string>, fields: any[]): Array<{isValid: boolean; value: any; error?: string}> {
    return fields.map(field => {
      const response = responses[field.name];
      if (!response) {
        return {
          isValid: false,
          value: null,
          error: `Please provide a value for ${field.name}`
        };
      }
      
      return this.missingInfoDetector.validateResponse(response, field);
    });
  }

  private async generateSuggestions(userInput: string): Promise<string[]> {
    const suggestions = [
      "Try describing your request differently",
      "Be more specific about what API or service you want to use",
      "Check if you have the right tools loaded"
    ];

    try {
      const similarTools = await this.toolMatcher.findSimilarTools(userInput, 3);
      if (similarTools.length > 0) {
        suggestions.unshift("Did you mean:");
        similarTools.forEach(tool => {
          suggestions.push(`- ${tool.tool.name}: ${tool.tool.description}`);
        });
      }
    } catch (error) {
      // Ignore errors in suggestion generation
    }

    return suggestions;
  }

  getConversationHistory(conversationId: string): ConversationContext | undefined {
    return this.conversationManager.getConversation(conversationId);
  }

  async saveConversation(conversationId: string): Promise<void> {
    await this.conversationManager.saveConversation(conversationId);
  }

  async loadConversation(conversationId: string): Promise<ConversationContext | null> {
    return await this.conversationManager.loadConversation(conversationId);
  }

  async listConversations(): Promise<Array<{ id: string; lastActivity: Date; messageCount: number }>> {
    return await this.conversationManager.listConversations();
  }

  updateTools(tools: MCPTool[]): void {
    this.tools = tools;
  }
}