import { ConversationStore } from './ConversationStore.js';
import { MCPTool } from '../types/api.types.js';
import { ChromaDBToolMatcher } from '../tools/ChromaDBToolMatcher.js';
import { CurlCommandExecutor } from '../tools/CurlCommandExecutor.js';
import { LLMProvider } from './LLMProvider.js';
import { getLLMConfig } from '../config/llm-config.js';
import { EnhancedChatResponse, ConversationState } from '../types/conversation.types.js';

/**
 * ConversationalEngine - Main orchestrator for natural language API interactions
 * 
 * This class handles the complete workflow of:
 * - Processing natural language user input
 * - Matching user intent to available API tools using semantic search
 * - Extracting and validating parameters from user input
 * - Executing API calls via cURL commands
 * - Managing conversation state and context
 * - Providing intelligent responses and clarifications
 * 
 * The engine uses multiple AI models for different tasks:
 * - Semantic tool matching with embeddings
 * - Parameter extraction from natural language
 * - Response generation and formatting
 */
export class ConversationalEngine {
  private conversationStore: ConversationStore;
  private toolMatcher: ChromaDBToolMatcher;
  private executor: CurlCommandExecutor;
  private llm: LLMProvider;
  private tools: MCPTool[] = [];
  private conversationStates: Map<string, ConversationState> = new Map();
  private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.6; // Increased from 0.3


  constructor(modelName: string = 'gpt-4') {
    this.conversationStore = new ConversationStore();
    this.toolMatcher = new ChromaDBToolMatcher(process.env.OPENAI_API_KEY);
    this.executor = new CurlCommandExecutor();
    const config = getLLMConfig(modelName);
    this.llm = new LLMProvider(config);

    setInterval(() => this.cleanupStaleConversations(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Removes conversations that have been inactive for more than the timeout period
   */
  private cleanupStaleConversations(): void {
    const now = Date.now();
    for (const [id, state] of this.conversationStates.entries()) {
      if (now - state.lastActivity.getTime() > this.CONVERSATION_TIMEOUT) {
        this.conversationStates.delete(id);
      }
    }
  }

  /**
   * Updates the available API tools for the conversational engine
   * This method should be called whenever new tools are loaded or tools are updated
   */
  updateTools(tools: MCPTool[]): void {
    this.tools = tools;
    // Initialize tool matcher when tools are updated
    this.initializeToolMatcher();
  }

  /**
   * Initializes the tool matcher with embeddings for all available tools
   * This creates semantic embeddings for each tool to enable intelligent matching
   */
  async initializeToolMatcher(): Promise<void> {
    try {
      if (this.tools.length === 0) {
        console.log('ℹ️ No tools available to initialize tool matcher');
        return;
      }
      
      console.log(`🔧 Initializing tool matcher with ${this.tools.length} tools...`);
      await this.toolMatcher.initialize(this.tools);
      console.log('✅ Tool matcher initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize tool matcher:', error);
      // Don't throw error, just log it and continue
    }
  }

  /**
   * Starts a new conversation and returns a unique conversation ID
   * Creates initial conversation state and sends a welcome message
  */
  startConversation(): string {
    const context = this.conversationStore.createConversation();
    const conversationId = context.id;

    this.conversationStates.set(conversationId, {
      collectedParameters: {},
      missingRequiredFields: [],
      suggestedOptionalFields: [],
      conversationContext: [],
      lastActivity: new Date()
    });

    this.conversationStore.addMessage(
      conversationId,
      'assistant',
      'Hello! I\'m here to help you interact with APIs. Just tell me what you want to do in natural language, and I\'ll guide you through the process! 🚀'
    );

    return conversationId;
  }

  /**
   * Processes a user message and returns an appropriate response
   * This is the main entry point for handling user interactions
   * 
   * The method handles:
   * - Tool matching using semantic search
   * - Parameter extraction from natural language
   * - Validation of required fields
   * - API execution when all requirements are filled
   * - Clarification requests when information is missing
   */
  async processMessage(conversationId: string, userInput: string): Promise<EnhancedChatResponse> {
    this.conversationStore.addMessage(conversationId, 'user', userInput);

    const state = this.conversationStates.get(conversationId);
    if (!state) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    state.lastActivity = new Date();

    // If we're in the middle of collecting parameters, handle that first
    if (state.currentTool && (state.missingRequiredFields.length > 0 || state.suggestedOptionalFields.length > 0)) {
      return await this.handleParameterCollection(conversationId, userInput, state);
    }
    return await this.processNewRequest(conversationId, userInput, state);
  }

  // Processes a new user request by finding the best matching tool and extracting parameters
  private async processNewRequest(conversationId: string, userInput: string, state: ConversationState): Promise<EnhancedChatResponse> {
    const toolMatch = await this.toolMatcher.findBestMatch(userInput, this.tools);
    if (!toolMatch || toolMatch.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
      const response: EnhancedChatResponse = {
        message: `I couldn't find a suitable API for your request with sufficient confidence. Could you please be more specific about what you'd like to do?\n\nAvailable operations include:\n${this.getAvailableOperationsSummary()}`,
        needsClarification: false,
        conversationId
      };

      this.conversationStore.addMessage(conversationId, 'assistant', response.message);
      return response;
    }

    const { tool, confidence } = toolMatch;

    // Extract parameters from the user input
    const parameters = await this.extractParametersFromInput(userInput, tool);

    // Analyze what information we have and what's missing
    const analysis = await this.analyzeToolRequirements(tool, parameters, userInput);

    // NEVER auto-execute with missing required fields or placeholder values
    if (analysis.missingRequiredFields.length > 0 || this.hasPlaceholderValues(parameters)) {
      state.currentTool = tool;
      state.collectedParameters = this.sanitizeParameters(parameters);
      state.missingRequiredFields = analysis.missingRequiredFields;
      state.suggestedOptionalFields = analysis.suggestedOptionalFields;

      const clarificationRequest = this.createClarificationRequest(tool, analysis, state.collectedParameters);

      const response: EnhancedChatResponse = {
        message: clarificationRequest.message,
        needsClarification: true,
        clarificationRequest,
        toolMatch: {
          tool,
          confidence,
          parameters: state.collectedParameters
        },
        conversationId
      };

      this.conversationStore.addMessage(conversationId, 'assistant', response.message);
      return response;
    }

    // We have all required fields with valid values, execute
    return await this.executeTool(conversationId, tool, parameters);
  }

  /**
   * Handles parameter collection when the user is providing additional information
   * This method manages the back-and-forth conversation to gather required parameters
   */
  private async handleParameterCollection(conversationId: string, userInput: string, state: ConversationState): Promise<EnhancedChatResponse> {
    if (!state.currentTool) {
      throw new Error('No current tool in state');
    }

    // Check for cancellation intent
    if (this.isCancellationIntent(userInput)) {
      return this.handleCancellation(conversationId, state);
    }

    // Check if user wants to execute with current parameters
    if (this.isExecutionIntent(userInput) && state.missingRequiredFields.length === 0) {
      return await this.executeTool(conversationId, state.currentTool, state.collectedParameters);
    }

    // Extract new parameters from user input
    const newParameters = await this.extractParametersFromInput(userInput, state.currentTool);

    // Merge with existing parameters
    const updatedParameters = { ...state.collectedParameters, ...newParameters };

    // Update state
    state.collectedParameters = updatedParameters;

    // Re-analyze requirements
    const analysis = await this.analyzeToolRequirements(state.currentTool, updatedParameters, userInput);

    if (analysis.missingRequiredFields.length === 0 && !this.hasPlaceholderValues(updatedParameters)) {
      // All required fields collected with valid values, execute
      return await this.executeTool(conversationId, state.currentTool, updatedParameters);
    }

    // Still missing required fields or have placeholder values
    state.missingRequiredFields = analysis.missingRequiredFields;
    state.suggestedOptionalFields = analysis.suggestedOptionalFields;

    const clarificationRequest = this.createClarificationRequest(state.currentTool, analysis, updatedParameters);

    const response: EnhancedChatResponse = {
      message: clarificationRequest.message,
      needsClarification: true,
      clarificationRequest,
      toolMatch: {
        tool: state.currentTool,
        confidence: 1.0,
        parameters: updatedParameters
      },
      conversationId
    };

    this.conversationStore.addMessage(conversationId, 'assistant', response.message);
    return response;
  }

  // Detects if the user wants to cancel the current operation
  private isCancellationIntent(userInput: string): boolean {
    const cancellationPhrases = ['cancel', 'stop', 'quit', 'exit', 'nevermind', 'abort', 'stop it', 'stop it all', 'don\'t do it', 'no'];
    return cancellationPhrases.some(phrase => userInput.toLowerCase().includes(phrase));
  }

  // Handles cancellation by resetting the conversation state
  private handleCancellation(conversationId: string, state: ConversationState): EnhancedChatResponse {
    // Reset state
    state.currentTool = undefined;
    state.collectedParameters = {};
    state.missingRequiredFields = [];
    state.suggestedOptionalFields = [];

    const response: EnhancedChatResponse = {
      message: "Operation cancelled. How else can I help you?",
      needsClarification: false,
      conversationId
    };

    this.conversationStore.addMessage(conversationId, 'assistant', response.message);
    return response;
  }

  // Detects if the user wants to execute the current operation
  private isExecutionIntent(userInput: string): boolean {
    const executionPhrases = ['execute', 'proceed', 'run', 'go ahead', 'do it', 'submit', 'run it', 'run it all'];
    return executionPhrases.some(phrase => userInput.toLowerCase().includes(phrase));
  }

  /**
   * Analyzes tool requirements to determine what parameters are missing or optional
   * This method examines the tool's schema and compares it with provided 
   * return missing required fields and suggested optional fields 
   */
  private async analyzeToolRequirements(tool: MCPTool, initialParameters: Record<string, any>, userInput: string): Promise<{
    missingRequiredFields: string[];
    suggestedOptionalFields: string[];
  }> {
    const requiredFields = this.getRequiredFields(tool);
    const optionalFields = this.getOptionalFields(tool);

    // Filter out empty, null, or undefined parameters
    const providedFields = Object.keys(initialParameters).filter(field => {
      const value = initialParameters[field];
      return value !== undefined && value !== null && value !== '';
    });

    const missingRequired = requiredFields.filter(field => !providedFields.includes(field));

    // For GET requests, check if path parameters are required
    if (tool.endpoint.method === 'GET') {
      const pathParams = tool.endpoint.path.match(/\{([^}]+)\}/g) || [];
      const pathParamNames = pathParams.map(param => param.slice(1, -1));

      // Add path parameters to required fields if they're not provided
      pathParamNames.forEach(paramName => {
        if (!providedFields.includes(paramName) && !missingRequired.includes(paramName)) {
          missingRequired.push(paramName);
        }
      });
    }

    // Suggest optional fields that might be useful
    const suggestedOptional = optionalFields.filter(field => {
      const fieldSchema = tool.inputSchema?.properties?.[field] as any;
      if (!fieldSchema) return false;

      // Suggest fields that are commonly used or have good examples
      const hasExamples = fieldSchema.examples && fieldSchema.examples.length > 0;
      const hasEnum = fieldSchema.enum && fieldSchema.enum.length > 0;
      const hasDescription = fieldSchema.description && fieldSchema.description.length > 0;
      const isObjectType = fieldSchema.type === 'object';
      const isArrayType = fieldSchema.type === 'array';

      // Dynamic criteria: suggest fields that have examples, enums, descriptions, or are complex types
      return hasExamples || hasEnum || hasDescription || isObjectType || isArrayType;
    });

    return {
      missingRequiredFields: missingRequired,
      suggestedOptionalFields: suggestedOptional
    };
  }

  // Creates a user-friendly clarification request message
  private createClarificationRequest(tool: MCPTool, analysis: any, collectedParameters: Record<string, any>): any {
    const { missingRequiredFields, suggestedOptionalFields } = analysis;

    let message = `I'll help you with **${tool.name}** - ${tool.description.toLowerCase()}.`;

    // Show what we already have
    const validParameters = Object.entries(collectedParameters).filter(([_, value]) => !this.isPlaceholderValue(value));
    if (validParameters.length > 0) {
      message += `\n\n✅ **Information I have:**\n`;
      validParameters.forEach(([key, value]) => {
        message += `- **${key}**: ${Array.isArray(value) ? value.join(', ') : value}\n`;
      });
    }

    // Show required fields first
    if (missingRequiredFields.length > 0) {
      message += `\n\n🔴 **Required information needed:**\n`;
      missingRequiredFields.forEach((field, index) => {
        const fieldSchema = tool.inputSchema?.properties?.[field] as any;
        const fieldDescription = fieldSchema?.description || field;
        const enumValues = fieldSchema?.enum;
        const examples = fieldSchema?.examples;

        message += `${index + 1}. **${field}**: ${fieldDescription}`;

        if (enumValues && enumValues.length > 0) {
          message += ` (Options: ${enumValues.join(', ')})`;
        } else if (examples && examples.length > 0) {
          message += ` (Example: ${examples[0]})`;
        }

        message += `\n`;
      });
    }

    // Show optional fields if no required fields are missing
    if (missingRequiredFields.length === 0 && suggestedOptionalFields.length > 0) {
      message += `\n\n💡 **Optional fields you might want to add:**\n`;
      suggestedOptionalFields.forEach((field, index) => {
        const fieldSchema = tool.inputSchema?.properties?.[field] as any;
        const description = fieldSchema?.description || field;
        message += `${index + 1}. **${field}**: ${description}\n`;
      });

      message += `\nSay "execute" to proceed with current information, or provide additional fields.`;
    } else {
      message += `\n💡 **Tip**: You can provide multiple fields at once, like "name: Fluffy, status: available"`;
    }

    return {
      message,
      needsClarification: true,
      missingRequiredFields,
      suggestedOptionalFields
    };
  }

  // Suggests optional fields when all required fields are complete
  private async suggestOptionalFields(tool: MCPTool, analysis: any, collectedParameters: Record<string, any>): Promise<EnhancedChatResponse> {
    const { suggestedOptionalFields } = analysis;

    if (suggestedOptionalFields.length === 0) {
      return await this.executeTool('', tool, collectedParameters);
    }

    const message = `I have all the required information! Would you like to add any optional fields?\n\n💡 **Optional fields you might want to add:**\n` +
      suggestedOptionalFields.map((field, index) => {
        const fieldSchema = tool.inputSchema?.properties?.[field] as any;
        const description = fieldSchema?.description || field;
        return `${index + 1}. **${field}**: ${description}`;
      }).join('\n') +
      `\n\nJust tell me what you'd like to add, or say "execute" to proceed with what we have.`;

    return {
      message,
      needsClarification: true,
      clarificationRequest: {
        type: 'suggest_optional',
        message,
        missingFields: [],
        suggestedFields: suggestedOptionalFields.map(field => {
          const fieldSchema = tool.inputSchema?.properties?.[field] as any;
          return {
            name: field,
            description: fieldSchema?.description || field,
            reason: 'Commonly used field'
          };
        })
      },
      toolMatch: {
        tool,
        confidence: 1.0,
        parameters: collectedParameters
      },
      conversationId: ''
    };
  }

  // Extracts parameters from user input using AI-based intelligent extraction
  private async extractParametersFromInput(userInput: string, tool: MCPTool): Promise<Record<string, any>> {
    try {
      const schemaDescription = this.buildSchemaDescription(tool);
      const requiredFields = this.getRequiredFields(tool);
      const optionalFields = this.getOptionalFields(tool);

      const prompt = `
Extract parameters from the user input for the "${tool.name}" API.

API Description: ${tool.description}

Available Parameters:
${schemaDescription}

Required Fields: ${requiredFields.join(', ')}
Optional Fields: ${optionalFields.join(', ')}

User Input: "${userInput}"

Instructions:
1. Extract ONLY parameters that are explicitly mentioned or clearly implied
2. Use EXACT parameter names from the schema (not variations or synonyms)
3. Convert values to appropriate types (string, number, boolean, array)
4. For arrays, use comma-separated values or multiple entries
5. Return ONLY a valid JSON object with the extracted parameters
6. If no parameters are found, return an empty object {}
7. Map common terms to exact schema field names
8. IGNORE irrelevant words like "i", "want", "get", "by", "the", "is", "are", "with", "for", "to", "a", "an", "this", "that", "please", "help", "need", "like", "love", "hate", "good", "bad", "nice", "great", "awesome", "terrible", "okay", "fine", "well", "better", "best"
9. Focus on actual parameter values, not descriptive words
10. IMPORTANT: Map common field variations to exact schema names:
    - "id" → "petId" (for pet operations)
    - "id" → "orderId" (for order operations) 
    - "id" → "userId" (for user operations)
    - "name" → "petName" (if schema has petName)
    - "email" → "userEmail" (if schema has userEmail)

Examples:
- "id 5" → {"petId": 5} (for pet operations)
- "id 5" → {"orderId": 5} (for order operations)
- "name fluffy" → {"name": "fluffy"}
- "status available" → {"status": "available"}
- "photo url http://..." → {"photoUrls": ["http://..."]}
- "tags tag1,tag2" → {"tags": ["tag1", "tag2"]}
- "quantity 10" → {"quantity": 10}
- "price 29.99" → {"price": 29.99}

Extracted parameters:`;

      const response = await this.llm.generateResponse(prompt);
      const content = response.content.trim();

      if (content) {
        try {
          // Try to extract JSON from markdown code blocks
          let jsonContent = content;
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }

          const extracted = JSON.parse(jsonContent);
          const validated = this.validateExtractedValues(extracted, tool);

          return validated;
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          return {};
        }
      }
    } catch (error) {
      console.error('Error in AI extraction:', error);
    }

    return {};
  }

  // Builds a human-readable description of the tool's schema
  private buildSchemaDescription(tool: MCPTool): string {
    const properties = tool.inputSchema?.properties || {};
    const descriptions: string[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const schema = fieldSchema as any;
      const type = schema.type || 'string';
      const description = schema.description || '';
      const enumValues = schema.enum ? ` (options: ${schema.enum.join(', ')})` : '';
      const examples = schema.examples ? ` (examples: ${schema.examples.join(', ')})` : '';

      descriptions.push(
        `- ${fieldName} (${type}): ${description}${enumValues}${examples}`
      );
    }

    return descriptions.join('\n');
  }

  // Validates and filters extracted parameters to ensure only relevant ones are included
  private validateExtractedValues(extracted: Record<string, any>, tool: MCPTool): Record<string, any> {
    const properties = tool.inputSchema?.properties || {};
    const validated: Record<string, any> = {};

    // List of irrelevant words that should be filtered out
    const irrelevantWords = [
      'i', 'want', 'get', 'by', 'the', 'is', 'are', 'with', 'for', 'to', 'a', 'an',
      'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'their',
      'have', 'has', 'had', 'will', 'would', 'could', 'should', 'can', 'may',
      'please', 'help', 'need', 'like', 'love', 'hate', 'good', 'bad', 'nice',
      'great', 'awesome', 'terrible', 'okay', 'fine', 'well', 'better', 'best'
    ];

    for (const [key, value] of Object.entries(extracted)) {
      // Skip if the key is an irrelevant word
      if (irrelevantWords.includes(key.toLowerCase())) {
        continue;
      }

      // Skip if the value is an irrelevant word
      if (typeof value === 'string' && irrelevantWords.includes(value.toLowerCase())) {
        continue;
      }

      const fieldSchema = properties[key] as any;
      if (!fieldSchema) continue;

      const validatedValue = this.validateFieldValue(value, fieldSchema, key);
      if (validatedValue !== undefined && validatedValue !== null && validatedValue !== '') {
        validated[key] = validatedValue;
      }
    }

    return validated;
  }

  /**
  * Sanitizes parameters by removing placeholder values and empty entries
  * LLM extracts:
  *      {
  *         "userId": "123",
  *         "email": "john@example.com",
  *         "firstName": "",        // ❌ Empty
  *          "lastName": "Unknown",  // ❌ Placeholder
  *         "phone": "N/A"         // ❌ Placeholder
  *       }
  * the function should return:
  *     { 
  *       "userId": "123",
  *       "email": "john@example.com",
  *     }
  * @returns Record<string, any> - Cleaned parameters
  */
  private sanitizeParameters(parameters: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const placeholderValues = ['Unknown', 'unknown', '', 'N/A', 'n/a', 'TBD', 'tbd'];

    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && !placeholderValues.includes(value)) {
          sanitized[key] = value;
        } else if (Array.isArray(value)) {
          const filteredArray = value.filter(v => !placeholderValues.includes(v));
          if (filteredArray.length > 0) {
            sanitized[key] = filteredArray;
          }
        } else if (typeof value !== 'string') {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  // Validates a field value against its schema definition
  private validateFieldValue(value: any, fieldSchema: any, fieldName: string): any {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    // Handle status field - check for typos and case-insensitive matching
    if (fieldName === 'status' && fieldSchema?.enum) {
      const statusValue = String(value).toLowerCase();
      const validStatuses = fieldSchema.enum.map((s: string) => s.toLowerCase());


      return value; // Return as-is if no match found
    }

    // Handle tags field - convert string to proper tag object format
    if (fieldName === 'tags' && Array.isArray(value)) {
      return value.map((tag: any, index: number) => {
        if (typeof tag === 'string') {
          return { id: index + 1, name: tag };
        }
        return tag;
      });
    }

    // Handle category field - convert string to proper category object format
    if (fieldName === 'category' && typeof value === 'string') {
      return { id: 1, name: value };
    }



    return value;
  }

  // Gets the list of required fields for a tool
  private getRequiredFields(tool: MCPTool): string[] {
    return tool.inputSchema?.required || [];
  }

  // Gets the list of optional fields for a tool
  private getOptionalFields(tool: MCPTool): string[] {
    const properties = tool.inputSchema?.properties || {};
    const required = this.getRequiredFields(tool);
    return Object.keys(properties).filter(field => !required.includes(field));
  }

  // Executes a tool by generating and running a cURL command
  private async executeTool(conversationId: string, tool: MCPTool, parameters: Record<string, any>): Promise<EnhancedChatResponse> {
    try {
      const curlCommand = this.generateCurlCommand(tool, parameters);
      const executionResult = await this.executor.executeCurl(curlCommand);

      // Check if the response indicates an error
      const isError = this.isApiError(executionResult);

      let resultMessage: string;

      if (isError) {
        resultMessage = `❌ **API Error in ${tool.name}:**\n\n`;
        resultMessage += `**cURL Command:**\n\`\`\`bash\n${curlCommand}\n\`\`\`\n\n`;

        try {
          const errorResult = JSON.parse(executionResult);
          resultMessage += `**Error Response:**\n\`\`\`json\n${JSON.stringify(errorResult, null, 2)}\n\`\`\`\n\n`;
          resultMessage += `**Possible issues:**\n- Check if all required fields are provided\n- Verify field values are in the correct format\n- Ensure the API endpoint is accessible`;
        } catch {
          resultMessage += `**Error Response:**\n\`\`\`\n${executionResult}\n\`\`\``;
        }
      } else {
        resultMessage = `✅ **Successfully executed ${tool.name}!**\n\n`;
        resultMessage += `**cURL Command:**\n\`\`\`bash\n${curlCommand}\n\`\`\`\n\n`;

        try {
          const jsonResult = JSON.parse(executionResult);
          resultMessage += `**Response:**\n\`\`\`json\n${JSON.stringify(jsonResult, null, 2)}\n\`\`\``;
        } catch {
          resultMessage += `**Response:**\n\`\`\`\n${executionResult}\n\`\`\``;
        }

        resultMessage += `\n\nIs there anything else you'd like to do? 🎯`;
      }

      // Reset conversation state after execution
      const state = this.conversationStates.get(conversationId);
      if (state) {
        state.currentTool = undefined;
        state.collectedParameters = {};
        state.missingRequiredFields = [];
        state.suggestedOptionalFields = [];
      }

      const response: EnhancedChatResponse = {
        message: resultMessage,
        needsClarification: false,
        toolMatch: {
          tool,
          confidence: 1.0,
          parameters
        },
        conversationId
      };

      this.conversationStore.addMessage(conversationId, 'assistant', response.message);
      return response;
    } catch (error: any) {
      const errorMessage = `❌ **Execution Error in ${tool.name}:** ${error.message}\n\nPlease check your parameters and try again.`;

      // Reset conversation state after error
      const state = this.conversationStates.get(conversationId);
      if (state) {
        state.currentTool = undefined;
        state.collectedParameters = {};
        state.missingRequiredFields = [];
        state.suggestedOptionalFields = [];
      }

      const response: EnhancedChatResponse = {
        message: errorMessage,
        needsClarification: false,
        conversationId
      };

      this.conversationStore.addMessage(conversationId, 'assistant', response.message);
      return response;
    }
  }

  // Determines if an API response indicates an error
  private isApiError(response: string): boolean {
    try {
      const parsed = JSON.parse(response);
      // Check for common error indicators
      return !!(parsed.error || parsed.code >= 400 || parsed.message?.includes('error'));
    } catch {
      // If it's not JSON, check for common error text
      const lowerResponse = response.toLowerCase();
      return lowerResponse.includes('error') || lowerResponse.includes('exception') || lowerResponse.includes('failed');
    }
  }

  // Generates a cURL command for a tool with the given parameters
  private generateCurlCommand(tool: MCPTool, params: Record<string, any>): string {
    const { method, baseUrl, path } = tool.endpoint;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Only include parameters defined in the tool's inputSchema
    const allowedParams = tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties) : [];
    const filteredParams: Record<string, any> = {};
    for (const key of allowedParams) {
      if (params[key] !== undefined) {
        filteredParams[key] = params[key];
      }
    }

    // Build the URL with path parameters
    let url = `${baseUrl}${path}`;
    const pathParams = path.match(/\{([^}]+)\}/g) || [];
    // Process path parameters
    const processedParams = { ...filteredParams };
    pathParams.forEach(param => {
      const paramName = param.slice(1, -1);
      if (processedParams[paramName] !== undefined) {
        url = url.replace(param, encodeURIComponent(String(processedParams[paramName])));
        delete processedParams[paramName];
      }
    });

    // Process query parameters and request body
    let queryString = '';
    let body = '';
    const httpMethod = method.toUpperCase();
    // For GET/DELETE, add remaining parameters to query string
    if (["GET", "DELETE"].includes(httpMethod)) {
      const queryParams = new URLSearchParams();
      Object.entries(processedParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, String(value));
        }
      });
      queryString = queryParams.toString();
    } else {
      // For other methods, add remaining parameters to request body
      const bodyParams: Record<string, any> = {};
      Object.entries(processedParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          bodyParams[key] = value;
        }
      });
      if (Object.keys(bodyParams).length > 0) {
        body = JSON.stringify(bodyParams, null, 2);
      }
    }

    // Add query string to URL if present
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    // Build the curl command
    let curlCommand = `curl -X ${httpMethod} "${url}" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json"`;
    if (body) {
      curlCommand += ` \
      -d '${body}'`;
    }
    return curlCommand;
  }

  // list of all the tools + description
  private getAvailableOperationsSummary(): string {
    return this.tools.map(tool => `- ${tool.name}: ${tool.description || ''}`).join('\n');
  }

  // Checks if parameters contain placeholder values that should be replaced
  private hasPlaceholderValues(parameters: Record<string, any>): boolean {
    return Object.values(parameters).some(value => this.isPlaceholderValue(value));
  }

  // Checks if a value is a placeholder that should be replaced
  private isPlaceholderValue(value: any): boolean {
    if (typeof value === 'string') {
      return value.trim().toLowerCase() === 'string' || value.trim() === '';
    }
    return value === undefined || value === null;
  }

  // Saves a conversation to persistent storage
  async saveConversation(conversationId: string): Promise<void> {
    await this.conversationStore.saveConversation(conversationId);
  }

  // Loads a conversation from persistent storage
  async loadConversation(conversationId: string): Promise<any> {
    return await this.conversationStore.loadConversation(conversationId);
  }

  // Lists all available conversations
  async listConversations(): Promise<Array<{ id: string; lastActivity: Date; messageCount: number }>> {
    return await this.conversationStore.listConversations();
  }
}