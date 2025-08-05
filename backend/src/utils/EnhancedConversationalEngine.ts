import { ConversationManager } from './ConversationManager.js';
import { MCPTool } from '../types.js';
import { APIToolMatcher } from '../tools/api-tool-matcher.js';
import { CurlExecutor } from '../tools/executor.js';
import { MultiProviderLLM } from './MultiProviderLLM.js';
import { getLLMConfig } from '../config/llm-config.js';
import { v4 as uuidv4 } from 'uuid';

export interface EnhancedChatResponse {
  message: string;
  needsClarification: boolean;
  clarificationRequest?: {
    type: 'missing_required' | 'suggest_optional' | 'confirmation';
    message: string;
    missingFields: Array<{
      name: string;
      description: string;
      type: 'required' | 'optional';
      possibleValues?: string[];
      examples?: string[];
    }>;
    suggestedFields?: Array<{
      name: string;
      description: string;
      reason: string;
    }>;
  };
  toolMatch?: {
    tool: MCPTool;
    confidence: number;
    parameters: Record<string, any>;
  };
  executionResult?: any;
  conversationId: string;
}

export interface ConversationState {
  currentTool?: MCPTool;
  collectedParameters: Record<string, any>;
  missingRequiredFields: string[];
  suggestedOptionalFields: string[];
  conversationContext: string[];
  lastActivity: Date;
}

export class EnhancedConversationalEngine {
  private conversationManager: ConversationManager;
  private toolMatcher: APIToolMatcher;
  private executor: CurlExecutor;
  private llm: MultiProviderLLM;
  private tools: MCPTool[] = [];
  private conversationStates: Map<string, ConversationState> = new Map();
  private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.6; // Increased from 0.3

  constructor(modelName: string = 'gpt-4') {
    this.conversationManager = new ConversationManager();
    this.toolMatcher = new APIToolMatcher();
    this.executor = new CurlExecutor();
    const config = getLLMConfig(modelName);
    this.llm = new MultiProviderLLM(config);
    
    // Start cleanup interval
    setInterval(() => this.cleanupStaleConversations(), 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanupStaleConversations(): void {
    const now = Date.now();
    for (const [id, state] of this.conversationStates.entries()) {
      if (now - state.lastActivity.getTime() > this.CONVERSATION_TIMEOUT) {
        this.conversationStates.delete(id);
      }
    }
  }

  updateTools(tools: MCPTool[]): void {
    this.tools = tools;
  }

  startConversation(): string {
    const context = this.conversationManager.createConversation();
    const conversationId = context.id;
    
    this.conversationStates.set(conversationId, {
      collectedParameters: {},
      missingRequiredFields: [],
      suggestedOptionalFields: [],
      conversationContext: [],
      lastActivity: new Date()
    });

    this.conversationManager.addMessage(
      conversationId,
      'assistant',
      'Hello! I\'m here to help you interact with APIs. Just tell me what you want to do in natural language, and I\'ll guide you through the process! 🚀'
    );

    return conversationId;
  }

  async processMessage(conversationId: string, userInput: string): Promise<EnhancedChatResponse> {
    this.conversationManager.addMessage(conversationId, 'user', userInput);
    
    const state = this.conversationStates.get(conversationId);
    if (!state) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Update last activity
    state.lastActivity = new Date();

    // If we're in the middle of collecting parameters, handle that first
    if (state.currentTool && (state.missingRequiredFields.length > 0 || state.suggestedOptionalFields.length > 0)) {
      return await this.handleParameterCollection(conversationId, userInput, state);
    }

    // Process new request
    return await this.processNewRequest(conversationId, userInput, state);
  }

  private async processNewRequest(conversationId: string, userInput: string, state: ConversationState): Promise<EnhancedChatResponse> {
    // Find the best matching tool with improved confidence threshold
    const toolMatch = await this.findBestToolMatch(userInput);
    
    if (!toolMatch || toolMatch.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
      const response: EnhancedChatResponse = {
        message: `I couldn't find a suitable API for your request with sufficient confidence. Could you please be more specific about what you'd like to do?\n\nAvailable operations include:\n${this.getAvailableOperationsSummary()}`,
        needsClarification: false,
        conversationId
      };

      this.conversationManager.addMessage(conversationId, 'assistant', response.message);
      return response;
    }

    const { tool, parameters, confidence } = toolMatch;
    
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

      this.conversationManager.addMessage(conversationId, 'assistant', response.message);
      return response;
    }
    
    // We have all required fields with valid values, execute
    return await this.executeTool(conversationId, tool, parameters);
  }

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

    this.conversationManager.addMessage(conversationId, 'assistant', response.message);
    return response;
  }

  private isCancellationIntent(userInput: string): boolean {
    const cancellationPhrases = ['cancel', 'stop', 'quit', 'exit', 'nevermind', 'abort'];
    return cancellationPhrases.some(phrase => userInput.toLowerCase().includes(phrase));
  }

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

    this.conversationManager.addMessage(conversationId, 'assistant', response.message);
    return response;
  }

  private isExecutionIntent(userInput: string): boolean {
    const executionPhrases = ['execute', 'proceed', 'run', 'go ahead', 'do it', 'submit'];
    return executionPhrases.some(phrase => userInput.toLowerCase().includes(phrase));
  }

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

  private async extractParametersFromInput(userInput: string, tool: MCPTool): Promise<Record<string, any>> {
    try {
      const schemaDescription = this.buildSchemaDescription(tool);
      
      const prompt = `
Extract parameters from the user input for the "${tool.name}" API.

API Description: ${tool.description}
Available Parameters:
${schemaDescription}

User Input: "${userInput}"

Instructions:
1. Extract ALL parameters that are explicitly mentioned or clearly implied
2. Use exact parameter names from the schema
3. Convert values to appropriate types (string, number, boolean, array)
4. For arrays, use comma-separated values or multiple entries
5. Return ONLY a valid JSON object with the extracted parameters
6. If no parameters are found, return an empty object {}

Examples:
- "id 5" or "with id 5" → {"id": 5}
- "name fluffy" or "named fluffy" → {"name": "fluffy"}  
- "status available" → {"status": "available"}
- "photo url http://..." → {"photoUrls": ["http://..."]}
- "tags tag1,tag2" → {"tags": ["tag1", "tag2"]}

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
          return this.validateExtractedValues(extracted, tool);
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          return {};
        }
      }
    } catch (error) {
      console.error('Error in AI extraction:', error);
    }
    
    // Fallback to pattern matching
    return this.fallbackExtraction(userInput, tool);
  }

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

  private validateExtractedValues(extracted: Record<string, any>, tool: MCPTool): Record<string, any> {
    const properties = tool.inputSchema?.properties || {};
    const validated: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(extracted)) {
      const fieldSchema = properties[key] as any;
      if (!fieldSchema) continue;
      
      const validatedValue = this.validateFieldValue(value, fieldSchema, key);
      if (validatedValue !== undefined) { // Only add if it's not undefined (meaning it was processed)
        validated[key] = validatedValue;
      }
    }
    
    return validated;
  }

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

  private validateFieldValue(value: any, fieldSchema: any, fieldName: string): any {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    // Handle status field - check for typos and case-insensitive matching
    if (fieldName === 'status' && fieldSchema?.enum) {
      const statusValue = String(value).toLowerCase();
      const validStatuses = fieldSchema.enum.map((s: string) => s.toLowerCase());
      
      // Handle common typos
      const statusMappings: Record<string, string> = {
        'pendding': 'pending',
        'availble': 'available',
        'availabel': 'available'
      };
      
      const correctedStatus = statusMappings[statusValue] || statusValue;
      const matchedStatus = validStatuses.find(s => s === correctedStatus);
      
      if (matchedStatus) {
        // Return the original case from the enum
        return fieldSchema.enum.find((s: string) => s.toLowerCase() === matchedStatus);
      }
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

  private fallbackExtraction(userInput: string, tool: MCPTool): Record<string, any> {
    const properties = tool.inputSchema?.properties || {};
    const extracted: Record<string, any> = {};
    
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const schema = fieldSchema as any;
      const patterns = this.generatePatterns(fieldName, schema);
      
      for (const pattern of patterns) {
        const match = userInput.match(pattern);
        if (match && match[1]) {
          const value = this.validateFieldValue(match[1].trim(), schema, fieldName);
          if (value !== undefined) { // Only add if it's not undefined (meaning it was processed)
            extracted[fieldName] = value;
            break;
          }
        }
      }
    }
    
    return extracted;
  }

  private generatePatterns(fieldName: string, fieldSchema: any): RegExp[] {
    const patterns: RegExp[] = [];
    const fieldType = fieldSchema.type || 'string';
    const variations = this.getFieldNameVariations(fieldName);
  
    // Common patterns
    const commonPatterns = variations.flatMap(variation => [
      new RegExp(`\\b${variation}\\s*[:=]?\\s*"([^"]+)"`, 'i'),
      new RegExp(`\\b${variation}\\s*[:=]?\\s*'([^']+)'`, 'i'),
      new RegExp(`\\b${variation}\\s*[:=]?\\s*([^\\s,]+)`, 'i'),
      new RegExp(`\\bwith\\s+${variation}\\s+([^\\s,]+)`, 'i'),
      new RegExp(`\\bfor\\s+${variation}\\s+([^\\s,]+)`, 'i'),
      new RegExp(`\\b${variation}\\s+is\\s+([^\\s,]+)`, 'i'),
    ]);
  
    patterns.push(...commonPatterns);
  
    // Type-specific patterns
    if (fieldType === 'integer' || fieldType === 'number') {
      patterns.push(
        new RegExp(`\\b(\\d+)\\s+${variations.join('|')}\\b`, 'i'),
        new RegExp(`\\b${variations.join('|')}\\s+(\\d+)\\b`, 'i')
      );
    }
  
    if (fieldType === 'string') {
      patterns.push(
        new RegExp(`\\b${variations.join('|')}\\s+"([^"]+)"`, 'i'),
        new RegExp(`\\b${variations.join('|')}\\s+'([^']+)'`, 'i'),
        new RegExp(`\\b${variations.join('|')}\\s+([a-zA-Z][a-zA-Z0-9\\s]*)`, 'i')
      );
    }
  
    if (fieldType === 'array' || fieldName.toLowerCase().includes('url')) {
      patterns.push(
        new RegExp(`\\b${variations.join('|')}\\s*[:=]?\\s*(https?:\\/\\/[^\\s,]+)`, 'i'),
        new RegExp(`(https?:\\/\\/[^\\s,]+)\\s+${variations.join('|')}`, 'i')
      );
    }
  
    // Enum patterns
    if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
      const enumPattern = fieldSchema.enum.join('|');
      patterns.push(
        new RegExp(`\\b(${enumPattern})\\s+${variations.join('|')}`, 'i'),
        new RegExp(`\\b${variations.join('|')}\\s+(${enumPattern})`, 'i')
      );
    }
  
    return patterns;
  }

  private getFieldNameVariations(fieldName: string): string[] {
    const variations = new Set<string>();
    variations.add(fieldName);
    
    // Handle camelCase to space-separated
    const spaced = fieldName.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    variations.add(spaced);
    
    // Handle snake_case to space-separated
    const snakeToSpace = fieldName.replace(/_/g, ' ').toLowerCase();
    if (snakeToSpace !== fieldName) {
      variations.add(snakeToSpace);
    }
    
    // Handle common synonyms
    const synonyms: Record<string, string[]> = {
      id: ['identifier', 'number', 'num', '#'],
      name: ['title', 'label', 'fullname', 'full name'],
      email: ['e-mail', 'mail', 'email address'],
      phone: ['telephone', 'mobile', 'cell', 'phone number'],
      url: ['link', 'website', 'web', 'uri', 'web address'],
      address: ['location', 'street', 'postal address'],
      date: ['time', 'datetime', 'timestamp'],
      description: ['details', 'info', 'information', 'summary'],
      price: ['cost', 'amount', 'value', 'fee'],
      quantity: ['amount', 'number', 'count', 'total'],
    };
  
    for (const [key, values] of Object.entries(synonyms)) {
      if (fieldName.toLowerCase().includes(key)) {
        values.forEach(v => variations.add(v));
      }
    }
  
    return Array.from(variations).filter(Boolean);
  }

  private getRequiredFields(tool: MCPTool): string[] {
    return tool.inputSchema?.required || [];
  }

  private getOptionalFields(tool: MCPTool): string[] {
    const properties = tool.inputSchema?.properties || {};
    const required = this.getRequiredFields(tool);
    return Object.keys(properties).filter(field => !required.includes(field));
  }

  private async findBestToolMatch(userInput: string): Promise<{ tool: MCPTool; parameters: Record<string, any>; confidence: number } | null> {
    // Use semantic search with improved confidence threshold
    try {
      const result = await this.toolMatcher.findBestMatch(userInput, this.tools);
      if (result && result.confidence > this.MIN_CONFIDENCE_THRESHOLD) { // Increased from 0.3
        return {
          tool: result.tool,
          parameters: result.parameters || {},
          confidence: result.confidence
        };
      }
    } catch (error) {
      console.error('Error with semantic tool matcher:', error);
    }
    
    // Fallback to improved keyword matching
    return await this.keywordBasedMatching(userInput);
  }

  private async keywordBasedMatching(userInput: string): Promise<{ tool: MCPTool; parameters: Record<string, any>; confidence: number } | null> {
    const lowerInput = userInput.toLowerCase();
    const tokens = lowerInput.split(/\s+/);
    
    let bestMatch: { tool: MCPTool; confidence: number } | null = null;
    
    for (const tool of this.tools) {
      const toolName = tool.name.toLowerCase();
      const toolDescription = tool.description.toLowerCase();
      const method = tool.endpoint.method.toLowerCase();
      
      let score = 0;
      
      // Method matching
      if (tokens.includes(method) || (method === 'post' && (tokens.includes('create') || tokens.includes('add') || tokens.includes('save')))) {
        score += 0.3;
      }
      
      // Tool name matching
      if (tokens.some(token => toolName.includes(token) || token.includes(toolName.split('_')[0]))) {
        score += 0.4;
      }
      
      // Description matching
      const descWords = toolDescription.split(/\s+/);
      const matchedWords = tokens.filter(token => descWords.some(word => word.includes(token) || token.includes(word)));
      score += (matchedWords.length / tokens.length) * 0.3;
      
      if (score > (bestMatch?.confidence || 0) && score >= this.MIN_CONFIDENCE_THRESHOLD) {
        bestMatch = { tool, confidence: score };
      }
    }
    
    if (bestMatch) {
      const parameters = await this.extractParametersFromInput(userInput, bestMatch.tool);
      return {
        tool: bestMatch.tool,
        parameters: this.sanitizeParameters(parameters),
        confidence: bestMatch.confidence
      };
    }
    
    return null;
  }

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

      this.conversationManager.addMessage(conversationId, 'assistant', response.message);
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

      this.conversationManager.addMessage(conversationId, 'assistant', response.message);
      return response;
    }
  }

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

  private generateCurlCommand(tool: MCPTool, params: Record<string, any>): string {
    const { method, baseUrl, path } = tool.endpoint;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Build the URL with path parameters
    let url = `${baseUrl}${path}`;
    const pathParams = path.match(/\{([^}]+)\}/g) || [];
    
    // Process path parameters
    const processedParams = { ...params };
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
    if (['GET', 'DELETE'].includes(httpMethod)) {
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
    let curlCommand = `curl -X ${httpMethod} "${url}"`;

    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      if (value) {
        const headerValue = String(value).replace(/'/g, "'\\\''");
        curlCommand += ` \\
  -H '${key}: ${headerValue}'`;
      }
    });

    // Add body if present
    if (body) {
      const escapedBody = body.replace(/'/g, "'\\\''");
      curlCommand += ` \\
  -d '${escapedBody}'`;
    }

    return curlCommand;
  }

  async saveConversation(conversationId: string): Promise<void> {
    await this.conversationManager.saveConversation(conversationId);
  }

  async loadConversation(conversationId: string): Promise<any> {
    return await this.conversationManager.loadConversation(conversationId);
  }

  async listConversations(): Promise<Array<{ id: string; lastActivity: Date; messageCount: number }>> {
    return await this.conversationManager.listConversations();
  }

  private isPlaceholderValue(value: any): boolean {
    if (typeof value === 'string') {
      const placeholders = ['Unknown', 'unknown', 'N/A', 'n/a', 'TBD', 'tbd', 'placeholder'];
      return placeholders.includes(value);
    }
    if (Array.isArray(value)) {
      return value.every(v => this.isPlaceholderValue(v));
    }
    return false;
  }

  private hasPlaceholderValues(parameters: Record<string, any>): boolean {
    const placeholderValues = ['Unknown', 'unknown', '', 'N/A', 'n/a', 'TBD', 'tbd'];
    
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string' && placeholderValues.includes(value)) {
        return true;
      }
      if (Array.isArray(value) && value.some(v => typeof v === 'string' && placeholderValues.includes(v))) {
        return true;
      }
    }
    return false;
  }

  private getAvailableOperationsSummary(): string {
    const operations = this.tools.slice(0, 5).map(tool => `• ${tool.name}: ${tool.description}`).join('\n');
    return operations + (this.tools.length > 5 ? `\n... and ${this.tools.length - 5} more` : '');
  }
} 