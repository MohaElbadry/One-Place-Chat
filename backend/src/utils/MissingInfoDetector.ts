import { MCPTool } from '../types.js';
import { MissingInfoAnalysis, MissingField, ClarificationRequest } from '../types.js';
import OpenAI from 'openai';

export class MissingInfoDetector {
  private openai: OpenAI;

  constructor(openaiApiKey?: string) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey || process.env.OPENAI_API_KEY
    });
  }

  /**
   * Analyze user input against tool requirements to find missing information
   */
  async analyzeForMissingInfo(
    userInput: string,
    tool: MCPTool,
    conversationHistory: string = '',
    extractedInfo: Record<string, any> = {}
  ): Promise<MissingInfoAnalysis> {
    const requiredFields = this.extractRequiredFields(tool);
    const providedInfo = await this.extractProvidedInfo(userInput, conversationHistory);
    
    // Combine extracted info from conversation history
    const allProvidedInfo = { ...extractedInfo, ...providedInfo };
    
    const missingFields = this.findMissingFields(requiredFields, allProvidedInfo);
    const suggestedQuestions = await this.generateClarificationQuestions(missingFields, tool, userInput);

    return {
      hasMissingInfo: missingFields.length > 0,
      missingFields,
      confidence: this.calculateConfidence(requiredFields, missingFields),
      suggestedQuestions
    };
  }

  /**
   * Create a clarification request for missing information
   */
  async createClarificationRequest(
    missingInfo: MissingInfoAnalysis,
    tool: MCPTool,
    userInput: string
  ): Promise<ClarificationRequest> {
    const type = this.determineClarificationType(missingInfo.missingFields);
    const message = await this.generateClarificationMessage(missingInfo, tool, userInput);

    return {
      type,
      message,
      fields: missingInfo.missingFields,
      context: {
        toolName: tool.name,
        originalInput: userInput
      }
    };
  }

  /**
   * Extract required fields from tool schema
   */
  private extractRequiredFields(tool: MCPTool): MissingField[] {
    const fields: MissingField[] = [];
    
    if (tool.inputSchema?.properties) {
      const required = tool.inputSchema.required || [];
      
      for (const [fieldName, fieldSchema] of Object.entries(tool.inputSchema.properties)) {
        const isRequired = required.includes(fieldName);
        const schema = fieldSchema as any;
        
        fields.push({
          name: fieldName,
          description: schema.description || `${fieldName} parameter`,
          type: isRequired ? 'required' : 'optional',
          possibleValues: schema.enum,
          examples: schema.examples || this.generateExampleValues(fieldName, schema.type)
        });
      }
    }

    // Also check endpoint parameters
    if (tool.endpoint?.parameters) {
      for (const param of tool.endpoint.parameters) {
        if (param.required) {
          fields.push({
            name: param.name,
            description: param.description || `${param.name} parameter`,
            type: 'required',
            examples: this.generateExampleValues(param.name, param.type)
          });
        }
      }
    }

    return fields;
  }

  /**
   * Extract information provided by the user
   */
  private async extractProvidedInfo(userInput: string, conversationHistory: string): Promise<Record<string, any>> {
    try {
      const prompt = `
Extract structured information from the following user input and conversation history.
Return a JSON object with key-value pairs of information provided.

User Input: "${userInput}"
Conversation History: "${conversationHistory}"

Extract information like:
- Names, IDs, email addresses
- Dates, times, locations
- Numbers, quantities, amounts
- URLs, file paths
- Any other specific parameters mentioned

Return only valid JSON:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        try {
          return JSON.parse(content);
        } catch {
          // Fallback to simple regex extraction
          return this.extractWithRegex(userInput + ' ' + conversationHistory);
        }
      }
    } catch (error) {
      console.error('Error extracting provided info:', error);
    }

    return this.extractWithRegex(userInput + ' ' + conversationHistory);
  }

  /**
   * Fallback regex-based extraction
   */
  private extractWithRegex(text: string): Record<string, any> {
    const extracted: Record<string, any> = {};
    
    const patterns = {
      email: /[\w\.-]+@[\w\.-]+\.\w+/g,
      id: /(?:id|ID):\s*([a-zA-Z0-9_-]+)/g,
      number: /\b\d+\b/g,
      date: /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g,
      url: /https?:\/\/[^\s]+/g
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        extracted[key] = matches.length === 1 ? matches[0] : matches;
      }
    }

    return extracted;
  }

  /**
   * Find which required fields are missing
   */
  private findMissingFields(requiredFields: MissingField[], providedInfo: Record<string, any>): MissingField[] {
    return requiredFields.filter(field => {
      if (field.type === 'optional') return false;
      
      const providedValue = providedInfo[field.name];
      return !providedValue || (Array.isArray(providedValue) && providedValue.length === 0);
    });
  }

  /**
   * Generate clarification questions for missing fields
   */
  private async generateClarificationQuestions(
    missingFields: MissingField[],
    tool: MCPTool,
    userInput: string
  ): Promise<string[]> {
    if (missingFields.length === 0) return [];

    const questions: string[] = [];
    
    for (const field of missingFields) {
      const question = await this.generateFieldQuestion(field, tool, userInput);
      questions.push(question);
    }

    return questions;
  }

  /**
   * Generate a specific question for a missing field
   */
  private async generateFieldQuestion(field: MissingField, tool: MCPTool, userInput: string): Promise<string> {
    // Simple question generation
    let question = `What is the ${field.name}?`;
    
    if (field.description && field.description !== `${field.name} parameter`) {
      question = `${field.description}`;
      if (!question.endsWith('?')) {
        question += '?';
      }
    }

    if (field.examples && field.examples.length > 0) {
      question += ` (e.g., ${field.examples.slice(0, 2).join(', ')})`;
    }

    if (field.possibleValues && field.possibleValues.length > 0) {
      question += ` Choose from: ${field.possibleValues.join(', ')}`;
    }

    return question;
  }

  /**
   * Generate a comprehensive clarification message
   */
  private async generateClarificationMessage(
    missingInfo: MissingInfoAnalysis,
    tool: MCPTool,
    userInput: string
  ): Promise<string> {
    if (missingInfo.missingFields.length === 0) {
      return "I have all the information needed to proceed.";
    }

    const fieldCount = missingInfo.missingFields.length;
    let message = `I'd be happy to help you with that! To use the ${tool.name} API, I need ${fieldCount === 1 ? 'one more piece of information' : `${fieldCount} more pieces of information`}:\n\n`;
    
    missingInfo.suggestedQuestions.forEach((question, index) => {
      message += `${index + 1}. ${question}\n`;
    });

    message += `\nPlease provide ${fieldCount === 1 ? 'this information' : 'these details'} so I can complete your request.`;
    
    return message;
  }

  /**
   * Determine the type of clarification needed
   */
  private determineClarificationType(missingFields: MissingField[]): ClarificationRequest['type'] {
    const requiredCount = missingFields.filter(f => f.type === 'required').length;
    
    if (requiredCount > 0) {
      return 'missing_required';
    }
    
    return 'parameter_validation';
  }

  /**
   * Calculate confidence in the missing info analysis
   */
  private calculateConfidence(allFields: MissingField[], missingFields: MissingField[]): number {
    if (allFields.length === 0) return 1.0;
    
    const providedFields = allFields.length - missingFields.length;
    return providedFields / allFields.length;
  }

  /**
   * Generate example values for fields
   */
  private generateExampleValues(fieldName: string, fieldType?: string): string[] {
    const examples: Record<string, string[]> = {
      id: ['12345', 'user-001'],
      email: ['user@example.com', 'john.doe@company.com'],
      name: ['John Doe', 'Jane Smith'],
      url: ['https://example.com', 'https://api.service.com'],
      date: ['2024-01-15', '01/15/2024'],
      time: ['14:30', '2:30 PM'],
      location: ['New York', 'San Francisco'],
      status: ['active', 'pending', 'completed'],
      type: ['standard', 'premium', 'basic']
    };

    // Check field name for patterns
    const lowerName = fieldName.toLowerCase();
    for (const [pattern, values] of Object.entries(examples)) {
      if (lowerName.includes(pattern)) {
        return values;
      }
    }

    // Fallback based on type
    if (fieldType === 'string') return ['example text'];
    if (fieldType === 'number') return ['123', '456'];
    if (fieldType === 'boolean') return ['true', 'false'];
    
    return ['example value'];
  }

  /**
   * Validate user response against expected field
   */
  validateResponse(response: string, field: MissingField): { isValid: boolean; value: any; error?: string } {
    const trimmedResponse = response.trim();
    
    if (!trimmedResponse) {
      return {
        isValid: false,
        value: null,
        error: `${field.name} cannot be empty`
      };
    }

    if (field.possibleValues && field.possibleValues.length > 0) {
      if (!field.possibleValues.some(val => 
        val.toLowerCase() === trimmedResponse.toLowerCase()
      )) {
        return {
          isValid: false,
          value: null,
          error: `${field.name} must be one of: ${field.possibleValues.join(', ')}`
        };
      }
    }

    return {
      isValid: true,
      value: trimmedResponse
    };
  }
}