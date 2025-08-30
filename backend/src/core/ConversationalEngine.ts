import { ConversationStoreChroma } from './ConversationStoreChroma.js';
import { MCPTool } from '../types/api.types.js';
import { ChromaDBToolMatcher } from '../tools/ChromaDBToolMatcher.js';
import { ChromaDBService } from '../database/ChromaDBService.js';
import { CurlCommandExecutor } from '../tools/CurlCommandExecutor.js';
import { CurlCommandGenerator } from '../tools/CurlCommandGenerator.js';
import { LLMProvider } from './LLMProvider.js';
import { getLLMConfig } from '../config/llm-config.js';
import { appConfig } from '../config/app-config.js';
import { EnhancedChatResponse, ConversationState } from '../types/conversation.types.js';
import { ChromaDBToolLoader } from '../tools/ChromaDBToolLoader.js';

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
  private conversationStore: ConversationStoreChroma;
  private toolMatcher: ChromaDBToolMatcher;
  private executor: CurlCommandExecutor;
  private llm: LLMProvider;
  private tools: MCPTool[] = [];
  private conversationStates: Map<string, ConversationState> = new Map();
  private readonly CONVERSATION_TIMEOUT = appConfig.conversational.conversationTimeoutMs;
  private readonly MIN_CONFIDENCE_THRESHOLD = appConfig.conversational.minConfidenceThreshold;
  private cleanupInterval: NodeJS.Timeout | null = null;


  constructor(modelName: string = 'gpt-4') {
    const chromaService = new ChromaDBService();
    this.conversationStore = new ConversationStoreChroma(chromaService);
    this.toolMatcher = new ChromaDBToolMatcher(process.env.OPENAI_API_KEY);
    this.executor = new CurlCommandExecutor();
    const config = getLLMConfig(modelName);
    this.llm = new LLMProvider(config);

    // Note: Conversation store will be initialized later via initializeConversationStore()

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Start the cleanup interval for stale conversations
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConversations();
    }, appConfig.conversational.cleanupIntervalMs);
  }

  /**
   * Clean up resources and stop intervals
   */
  async destroy(): Promise<void> {
    try {
      // Clear the cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Close conversation store
      if (this.conversationStore) {
        await this.conversationStore.close();
      }

      // Close tool matcher
      if (this.toolMatcher) {
        await this.toolMatcher.close();
      }

      // Clear conversation states
      this.conversationStates.clear();

      console.log('✅ ConversationalEngine destroyed successfully');
    } catch (error) {
      console.error('❌ Error destroying ConversationalEngine:', error);
    }
  }

  /**
   * Initialize the conversation store (public method)
   */
  async initializeConversationStore(): Promise<void> {
    try {
      await this.conversationStore.initialize();
    } catch (error) {
      console.error('❌ Failed to initialize conversation store:', error);
    }
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
  async updateTools(tools: MCPTool[]): Promise<void> {
    this.tools = tools;
    // Immediately initialize tool matcher when tools are updated
    if (tools.length > 0) {
      try {
        await this.initializeToolMatcher();
        console.log(`✅ Tool matcher initialized with ${tools.length} tools`);
      } catch (error) {
        console.error('❌ Failed to initialize tool matcher after tool update:', error);
      }
    } else {
      console.log('ℹ️ No tools available, tool matcher not initialized');
    }
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
      
      await this.toolMatcher.initialize(this.tools);
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
   * 
   * @param conversationId - The conversation ID
   * @param userInput - The user's message
   * @param addUserMessage - Whether to add the user message to the conversation store (default: true for CLI compatibility)
   * @param addAssistantMessage - Whether to add the assistant message to the conversation store (default: true for CLI compatibility)
   */
  async processMessage(conversationId: string, userInput: string, addUserMessage: boolean = true, addAssistantMessage: boolean = true): Promise<EnhancedChatResponse> {
    // Add user message only if requested (CLI calls with default true, API calls with false)
    if (addUserMessage) {
      this.conversationStore.addMessage(conversationId, 'user', userInput);
    }

    const state = this.conversationStates.get(conversationId);
    if (!state) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    state.lastActivity = new Date();

    // If we're in the middle of collecting parameters, handle that first
    if (state.currentTool && (state.missingRequiredFields.length > 0 || state.suggestedOptionalFields.length > 0)) {
      return await this.handleParameterCollection(conversationId, userInput, state, addAssistantMessage);
    }
    return await this.processNewRequest(conversationId, userInput, state, addAssistantMessage);
  }

  /**
   * Process a new user message with conversational AI logic
   * This method handles the complete workflow from user input to response generation
   */
  private async processNewRequest(conversationId: string, userInput: string, state: ConversationState, addAssistantMessage: boolean = true): Promise<EnhancedChatResponse> {
    // Always load tools fresh from the database - NO CACHING
    try {
      const toolLoader = new ChromaDBToolLoader();
      const freshTools = await toolLoader.loadTools();
      this.tools = freshTools; // Always use fresh tools, no caching
      
      if (this.tools.length === 0) {
        const response: EnhancedChatResponse = {
          message: `🔧 **No API tools available yet!**\n\nTo get started, you need to upload an OpenAPI specification first.\n\n**How to upload tools:**\n1. Click the "Upload Tools" button in the top right\n2. Select your OpenAPI JSON file\n3. Wait for the tools to be generated\n4. Then you can start using the API!\n\n**What you can upload:**\n- OpenAPI 3.x specifications\n- Swagger 2.0 specifications\n- Any JSON file with API endpoints\n\nOnce you have tools uploaded, I'll be able to help you interact with your APIs! 🚀`,
          needsClarification: false,
          conversationId
        };
        if (addAssistantMessage) {
          this.conversationStore.addMessage(conversationId, 'assistant', response.message);
        }
        return response;
      }
      
      // Initialize tool matcher with fresh tools
      await this.initializeToolMatcher();
      
    } catch (error) {
      console.error('❌ Failed to load fresh tools:', error);
      // If we can't load tools, show the upload message
      const response: EnhancedChatResponse = {
        message: `🔧 **Unable to load API tools!**\n\nThere was an error loading the tools from the database. Please try uploading your OpenAPI specification again.\n\n**How to upload tools:**\n1. Click the "Upload Tools" button in the top right\n2. Select your OpenAPI JSON file\n3. Wait for the tools to be generated\n\nIf the problem persists, please check your ChromaDB connection.`,
        needsClarification: false,
        conversationId
      };
      if (addAssistantMessage) {
        this.conversationStore.addMessage(conversationId, 'assistant', response.message);
      }
      return response;
    }

    const toolMatch = await this.toolMatcher.findBestMatch(userInput, this.tools);
    if (!toolMatch || toolMatch.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
      const response: EnhancedChatResponse = {
        message: `I couldn't find a suitable API for your request with sufficient confidence. Could you please be more specific about what you'd like to do?\n\nAvailable operations include:\n${this.getAvailableOperationsSummary()}`,
        needsClarification: false,
        conversationId
      };

      if (addAssistantMessage) {
        this.conversationStore.addMessage(conversationId, 'assistant', response.message);
      }
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

      if (addAssistantMessage) {
        this.conversationStore.addMessage(conversationId, 'assistant', response.message);
      }
      return response;
    }

    // We have all required fields with valid values, execute
    return await this.executeTool(conversationId, tool, parameters, addAssistantMessage);
  }

  /**
   * Handles parameter collection when the user is providing additional information
   * This method manages the back-and-forth conversation to gather required parameters
   */
  private async handleParameterCollection(conversationId: string, userInput: string, state: ConversationState, addAssistantMessage: boolean = true): Promise<EnhancedChatResponse> {
    if (!state.currentTool) {
      throw new Error('No current tool in state');
    }

    // Check for cancellation intent
    if (this.isCancellationIntent(userInput)) {
      return this.handleCancellation(conversationId, state, addAssistantMessage);
    }

    // Check if user wants to execute with current parameters
    if (this.isExecutionIntent(userInput) && state.missingRequiredFields.length === 0) {
      return await this.executeTool(conversationId, state.currentTool, state.collectedParameters, addAssistantMessage);
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
      return await this.executeTool(conversationId, state.currentTool, updatedParameters, addAssistantMessage);
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
  private handleCancellation(conversationId: string, state: ConversationState, addAssistantMessage: boolean = true): EnhancedChatResponse {
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

    if (addAssistantMessage) {
      this.conversationStore.addMessage(conversationId, 'assistant', response.message);
    }
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
  private async suggestOptionalFields(tool: MCPTool, analysis: any, collectedParameters: Record<string, any>, addAssistantMessage: boolean = true): Promise<EnhancedChatResponse> {
    const { suggestedOptionalFields } = analysis;

    if (suggestedOptionalFields.length === 0) {
      return await this.executeTool('', tool, collectedParameters, addAssistantMessage);
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
  private async executeTool(conversationId: string, tool: MCPTool, parameters: Record<string, any>, addAssistantMessage: boolean = true): Promise<EnhancedChatResponse> {
    try {
      const curlCommand = CurlCommandGenerator.generateCurlCommand(tool, parameters);
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
        resultMessage = `**Successfully executed ${tool.name}!**\n\n`;
        resultMessage += `**cURL Command:**\n\`\`\`bash\n${curlCommand}\n\`\`\`\n\n`;

        try {
          const jsonResult = JSON.parse(executionResult);
          resultMessage += `**Response:**\n\`\`\`json\n${JSON.stringify(jsonResult, null, 2)}\n\`\`\``;
        } catch {
          resultMessage += `**Response:**\n\`\`\`\n${executionResult}\n\`\`\``;
        }

        resultMessage += `\n\nIs there anything else you'd like to do? `;
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

      if (addAssistantMessage) {
        this.conversationStore.addMessage(conversationId, 'assistant', response.message);
      }
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

      if (addAssistantMessage) {
        this.conversationStore.addMessage(conversationId, 'assistant', response.message);
      }
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

  // list of all the tools + description
  private getAvailableOperationsSummary(): string {
    return this.tools.map(tool => `- ${tool.name}: ${tool.description || ''}`).join('\n');
  }

  // Checks if parameters contain placeholder values that should be replaced
  private hasPlaceholderValues(parameters: Record<string, any>): boolean {
    return CurlCommandGenerator.hasPlaceholderValues(parameters);
  }

  // Checks if a value is a placeholder that should be replaced
  private isPlaceholderValue(value: any): boolean {
    return CurlCommandGenerator.isPlaceholderValue(value);
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