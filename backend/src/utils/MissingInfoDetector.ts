// Generic MissingInfoDetector that works with any API schema
import { MCPTool } from '../types.js';
import { MissingInfoAnalysis, MissingField, ClarificationRequest } from '../types.js';
import OpenAI from 'openai';

export class GenericMissingInfoDetector {
  private openai: OpenAI;

  constructor(openaiApiKey?: string) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey || process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generic analysis that works with any tool schema
   */
  async analyzeForMissingInfo(
    userInput: string,
    tool: MCPTool,
    conversationHistory: string = '',
    extractedInfo: Record<string, any> = {}
  ): Promise<MissingInfoAnalysis> {
    const requiredFields = this.extractRequiredFields(tool);
    
    // Use AI-powered extraction for any schema
    const providedInfo = await this.extractInformationGeneric(
      userInput, 
      conversationHistory, 
      tool
    );
    
    // Combine with previous context
    const allProvidedInfo = { ...extractedInfo, ...providedInfo };
    
    // Find missing required fields
    const missingRequiredFields = this.findMissingFields(requiredFields, allProvidedInfo);
    
    // Generate questions only for missing required fields
    const suggestedQuestions = await this.generateGenericClarificationQuestions(
      missingRequiredFields, 
      tool
    );

    return {
      hasMissingInfo: missingRequiredFields.length > 0,
      missingFields: missingRequiredFields,
      confidence: this.calculateConfidence(requiredFields, missingRequiredFields),
      suggestedQuestions
    };
  }

  /**
   * Generic information extraction using OpenAI with tool schema
   */
  private async extractInformationGeneric(
    userInput: string,
    conversationHistory: string,
    tool: MCPTool
  ): Promise<Record<string, any>> {
    try {
      // First try AI extraction
      const aiExtracted = await this.extractWithAI(userInput, conversationHistory, tool);
      if (Object.keys(aiExtracted).length > 0) {
        return aiExtracted;
      }
  
      // Fallback to pattern matching
      const patternExtracted = this.fallbackGenericExtraction(userInput, tool);
      if (Object.keys(patternExtracted).length > 0) {
        return patternExtracted;
      }
  
      // If still nothing found, try with a more permissive pattern
      return this.extractWithPermissivePatterns(userInput, tool);
    } catch (error) {
      console.error('Error in generic extraction:', error);
      return this.fallbackGenericExtraction(userInput, tool);
    }
  }
  
  private async extractWithAI(
    userInput: string,
    conversationHistory: string,
    tool: MCPTool
  ): Promise<Record<string, any>> {
    try {
      const schemaDescription = this.buildSchemaDescription(tool);
      const requiredFields = this.extractRequiredFields(tool);
      
      const prompt = `
  Extract parameters from the user input for the "${tool.name}" API.
  
  API Description: ${tool.description}
  Required Parameters: ${requiredFields.map(f => f.name).join(', ')}
  
  Available Parameters:
  ${schemaDescription}
  
  User Input: "${userInput}"
  Previous Context: "${conversationHistory}"
  
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
  - "email john@example.com" → {"email": "john@example.com"}
  
  Extracted parameters:`;
  
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000
      });
  
      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        try {
          const extracted = JSON.parse(content);
          return this.validateExtractedValues(extracted, tool);
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
  
  private extractWithPermissivePatterns(userInput: string, tool: MCPTool): Record<string, any> {
    const properties = tool.inputSchema?.properties || {};
    const extracted: Record<string, any> = {};
    
    // Try to extract key-value pairs in various formats
    const keyValuePatterns = [
      /(\w+)\s*[:=]\s*([^,\s]+)/g,        // key: value
      /(\w+)\s*=\s*"([^"]+)"/g,           // key="value"
      /(\w+)\s*=\s*'([^']+)'/g,           // key='value'
      /(\w+)\s+is\s+([^,\s]+)/gi,         // key is value
      /with\s+(\w+)\s+([^,\s]+)/gi,       // with key value
      /for\s+(\w+)\s+([^,\s]+)/gi,        // for key value
    ];
  
    for (const pattern of keyValuePatterns) {
      let match;
      while ((match = pattern.exec(userInput)) !== null) {
        const [_, key, value] = match;
        const fieldSchema = properties[key];
        if (fieldSchema) {
          const validated = this.validateFieldValue(value, fieldSchema, key);
          if (validated !== null) {
            extracted[key] = validated;
          }
        }
      }
    }
  
    return extracted;
  }

  /**
   * Build human-readable schema description for any tool
   */
  private buildSchemaDescription(tool: MCPTool): string {
    const properties = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];
    
    const descriptions: string[] = [];
    
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const schema = fieldSchema as any;
      const isRequired = required.includes(fieldName);
      const type = schema.type || 'string';
      const description = schema.description || '';
      const enumValues = schema.enum ? ` (options: ${schema.enum.join(', ')})` : '';
      const examples = schema.examples ? ` (examples: ${schema.examples.join(', ')})` : '';
      
      descriptions.push(
        `- ${fieldName} (${type}${isRequired ? ', required' : ', optional'}): ${description}${enumValues}${examples}`
      );
    }
    
    return descriptions.join('\n');
  }

  /**
   * Validate extracted values against the tool schema
   */
  private validateExtractedValues(extracted: Record<string, any>, tool: MCPTool): Record<string, any> {
    const properties = tool.inputSchema?.properties || {};
    const validated: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(extracted)) {
      const fieldSchema = properties[key] as any;
      if (!fieldSchema) {
        console.warn(`Field ${key} not found in schema, skipping`);
        continue;
      }
      
      const validatedValue = this.validateFieldValue(value, fieldSchema, key);
      if (validatedValue !== null) {
        validated[key] = validatedValue;
      }
    }
    
    return validated;
  }

  /**
   * Validate and convert a single field value
   */
  private validateFieldValue(value: any, fieldSchema: any, fieldName: string): any {
    const expectedType = fieldSchema.type;
    
    try {
      switch (expectedType) {
        case 'integer':
        case 'number':
          const num = typeof value === 'number' ? value : parseInt(String(value), 10);
          return isNaN(num) ? null : num;
          
        case 'boolean':
          if (typeof value === 'boolean') return value;
          const str = String(value).toLowerCase();
          return str === 'true' || str === '1' || str === 'yes';
          
        case 'array':
          if (Array.isArray(value)) return value;
          return [value]; // Wrap single values in array
          
        case 'object':
          if (typeof value === 'object' && value !== null) return value;
          try {
            return JSON.parse(String(value));
          } catch {
            return null;
          }
          
        case 'string':
        default:
          return String(value);
      }
    } catch (error) {
      console.warn(`Failed to validate field ${fieldName}:`, error);
      return null;
    }
  }

  /**
   * Generic fallback extraction using dynamic patterns
   */
  private fallbackGenericExtraction(userInput: string, tool: MCPTool): Record<string, any> {
    const properties = tool.inputSchema?.properties || {};
    const extracted: Record<string, any> = {};
    
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const schema = fieldSchema as any;
      const patterns = this.generateGenericPatterns(fieldName, schema);
      
      for (const pattern of patterns) {
        const match = userInput.match(pattern);
        if (match && match[1]) {
          const value = this.validateFieldValue(match[1].trim(), schema, fieldName);
          if (value !== null) {
            extracted[fieldName] = value;
            break; // Found match for this field
          }
        }
      }
    }
    
    return extracted;
  }

  private generateGenericPatterns(fieldName: string, fieldSchema: any): RegExp[] {
    const patterns: RegExp[] = [];
    const fieldType = fieldSchema.type || 'string';
    const variations = this.getFieldNameVariations(fieldName);
  
    // Common patterns for all field types
    const commonPatterns = variations.flatMap(variation => [
      new RegExp(`\\b${variation}\\s*[:=]?\\s*"([^"]+)"`, 'i'),  // key: "value"
      new RegExp(`\\b${variation}\\s*[:=]?\\s*'([^']+)'`, 'i'),  // key: 'value'
      new RegExp(`\\b${variation}\\s*[:=]?\\s*([^\\s,]+)`, 'i'), // key: value
      new RegExp(`\\bwith\\s+${variation}\\s+([^\\s,]+)`, 'i'),  // with key value
      new RegExp(`\\bfor\\s+${variation}\\s+([^\\s,]+)`, 'i'),   // for key value
      new RegExp(`\\b${variation}\\s+is\\s+([^\\s,]+)`, 'i'),     // key is value
    ]);
  
    patterns.push(...commonPatterns);
  
    // Type-specific patterns
    if (fieldType === 'integer' || fieldType === 'number') {
      patterns.push(
        new RegExp(`\\b(\\d+)\\s+${variations.join('|')}\\b`, 'i'),  // 123 key
        new RegExp(`\\b${variations.join('|')}\\s+(\\d+)\\b`, 'i')   // key 123
      );
    }
  
    if (fieldType === 'string') {
      patterns.push(
        new RegExp(`\\b${variations.join('|')}\\s+"([^"]+)"`, 'i'),  // key "value"
        new RegExp(`\\b${variations.join('|')}\\s+'([^']+)'`, 'i'),  // key 'value'
        new RegExp(`\\b${variations.join('|')}\\s+([a-zA-Z][a-zA-Z0-9\\s]*)`, 'i')  // key value
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

  /**
   * Generate common variations of field names
   */
  private getFieldNameVariations(fieldName: string): string[] {
    const variations = new Set<string>();
  
    // Add the original field name
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
  
    // Add synonyms if they exist
    for (const [key, values] of Object.entries(synonyms)) {
      if (fieldName.toLowerCase().includes(key)) {
        values.forEach(v => variations.add(v));
      }
    }
  
    // Handle plural/singular forms
    if (fieldName.endsWith('s')) {
      variations.add(fieldName.slice(0, -1)); // Remove 's'
    } else {
      variations.add(`${fieldName}s`); // Add 's'
    }
  
    // Convert to array and filter out any empty strings
    return Array.from(variations).filter(Boolean);
  }
  /**
   * Generate generic clarification questions
   */
  private async generateGenericClarificationQuestions(
    missingFields: MissingField[],
    tool: MCPTool
  ): Promise<string[]> {
    if (missingFields.length === 0) return [];

    const questions: string[] = [];
    
    for (const field of missingFields) {
      const question = this.generateGenericFieldQuestion(field);
      questions.push(question);
    }

    return questions;
  }

  /**
   * Generate a question for any field based on its schema
   */
  private generateGenericFieldQuestion(field: MissingField): string {
    let question = `What is the ${field.name}?`;
    
    if (field.description && field.description !== `${field.name} parameter`) {
      question = `What ${field.description.toLowerCase()}?`;
      if (!question.endsWith('?')) {
        question += '?';
      }
    }

    // Add constraints or examples
    const constraints: string[] = [];
    
    if (field.possibleValues && field.possibleValues.length > 0) {
      constraints.push(`Choose from: ${field.possibleValues.join(', ')}`);
    }
    
    if (field.examples && field.examples.length > 0) {
      constraints.push(`Example: ${field.examples[0]}`);
    }
    
    if (constraints.length > 0) {
      question += ` (${constraints.join(', ')})`;
    }

    return question;
  }

  /**
   * Create enhanced clarification request
   */
  async createClarificationRequest(
    missingInfo: MissingInfoAnalysis,
    tool: MCPTool,
    userInput: string,
    providedInfo: Record<string, any> = {}
  ): Promise<ClarificationRequest> {
    if (missingInfo.missingFields.length === 0) {
      return {
        type: 'confirmation',
        message: "I have all the information needed to proceed.",
        fields: [],
        context: { toolName: tool.name, originalInput: userInput }
      };
    }

    const providedInfoSummary = Object.keys(providedInfo).length > 0 
      ? `\n\n✅ **Information I already have:**\n${Object.entries(providedInfo)
          .map(([key, value]) => `- **${key}**: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('\n')}`
      : '';

    const fieldCount = missingInfo.missingFields.length;
    let message = `Great! I can help you with ${tool.description.toLowerCase()}. ${providedInfoSummary}`;
    
    message += `\n\n❓ **I just need ${fieldCount === 1 ? 'one more thing' : `${fieldCount} more things`}:**\n\n`;
    
    missingInfo.suggestedQuestions.forEach((question, index) => {
      message += `${index + 1}. ${question}\n`;
    });

    return {
      type: 'missing_required',
      message,
      fields: missingInfo.missingFields,
      context: {
        toolName: tool.name,
        originalInput: userInput,
        providedInfo
      }
    };
  }

  // Utility methods
  private extractRequiredFields(tool: MCPTool): MissingField[] {
    const fields: MissingField[] = [];
    
    if (tool.inputSchema?.properties) {
      const required = tool.inputSchema.required || [];
      
      for (const [fieldName, fieldSchema] of Object.entries(tool.inputSchema.properties)) {
        if (required.includes(fieldName)) {
          const schema = fieldSchema as any;
          
          fields.push({
            name: fieldName,
            description: schema.description || `${fieldName} parameter`,
            type: 'required',
            possibleValues: schema.enum,
            examples: schema.examples || this.generateGenericExamples(fieldName, schema.type)
          });
        }
      }
    }

    return fields;
  }

  private generateGenericExamples(fieldName: string, fieldType?: string): string[] {
    // Generate examples based on field name and type
    const lowerName = fieldName.toLowerCase();
    
    if (lowerName.includes('id')) return ['1', '123', '456'];
    if (lowerName.includes('email')) return ['user@example.com'];
    if (lowerName.includes('name') || lowerName.includes('title')) return ['Example Name'];
    if (lowerName.includes('url')) return ['https://example.com'];
    if (lowerName.includes('phone')) return ['+1234567890'];
    if (lowerName.includes('date')) return ['2024-01-15'];
    if (lowerName.includes('price') || lowerName.includes('amount')) return ['99.99'];
    if (lowerName.includes('status')) return ['active', 'pending'];
    
    // Type-based examples
    if (fieldType === 'integer' || fieldType === 'number') return ['1', '10', '100'];
    if (fieldType === 'boolean') return ['true', 'false'];
    if (fieldType === 'array') return ['["item1", "item2"]'];
    
    return ['example value'];
  }

  private findMissingFields(requiredFields: MissingField[], providedInfo: Record<string, any>): MissingField[] {
    return requiredFields.filter(field => {
      const providedValue = providedInfo[field.name];
      return !providedValue || (Array.isArray(providedValue) && providedValue.length === 0);
    });
  }

  private calculateConfidence(allFields: MissingField[], missingFields: MissingField[]): number {
    if (allFields.length === 0) return 1.0;
    
    const providedFields = allFields.length - missingFields.length;
    return providedFields / allFields.length;
  }

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