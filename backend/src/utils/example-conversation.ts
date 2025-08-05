import { EnhancedConversationalChatEngine } from './ConversationalChatEngine.js';
import { MCPTool } from '../types.js';

// Example tool for demonstration
const exampleWeatherTool: MCPTool = {
  name: 'get_weather',
  description: 'Get current weather information for a specific location',
  inputSchema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city or location to get weather for'
      },
      units: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'Temperature units'
      }
    },
    required: ['location']
  },
  annotations: {
    method: 'GET',
    path: '/v1/current',
    deprecated: false,
    title: 'Weather API',
    openWorldHint: false,
    readOnlyHint: true
  },
  endpoint: {
    baseUrl: 'https://api.weather.com',
    path: '/v1/current',
    method: 'GET',
    parameters: [
      {
        name: 'location',
        in: 'query',
        required: true,
        description: 'Location to get weather for',
        type: 'string'
      },
      {
        name: 'units',
        in: 'query',
        required: false,
        description: 'Temperature units',
        type: 'string'
      }
    ]
  },
  security: [],
  execute: async () => {
    // Mock execution for demo
    return '{"location": "New York", "temperature": "72°F", "condition": "Sunny"}';
  }
};

// Mock the OpenAI dependency for demo purposes
class MockEnhancedConversationalChatEngine {
  private tools: MCPTool[];
  private conversationId: string = 'demo-conversation-001';
  private step: number = 0;

  constructor(tools: MCPTool[]) {
    this.tools = tools;
  }

  startConversation(): string {
    return this.conversationId;
  }

  async processMessage(conversationId: string, userInput: string): Promise<any> {
    this.step++;
    
    // Mock conversation flow
    if (this.step === 1) {
      // First request - ask for location
      return {
        message: `I'd be happy to help you with that! To use the get_weather API, I need 2 more pieces of information:

1. What is the location? (e.g., New York, San Francisco)
2. Temperature units? Choose from: celsius, fahrenheit

Please provide these details so I can complete your request.`,
        needsClarification: true,
        clarificationRequest: {
          type: 'missing_required',
          message: 'Missing required information',
          fields: [
            { name: 'location', description: 'Location to get weather for', type: 'required' },
            { name: 'units', description: 'Temperature units', type: 'optional' }
          ]
        }
      };
    } else if (this.step === 2) {
      // Still need units
      return {
        message: 'Great! I have the location as New York. What temperature units would you like? (celsius or fahrenheit)',
        needsClarification: true,
        clarificationRequest: {
          type: 'missing_required',
          message: 'Need temperature units',
          fields: [
            { name: 'units', description: 'Temperature units', type: 'required' }
          ]
        }
      };
    } else {
      // Execute the API call
      return {
        message: `✅ **API call executed successfully!**

**Response:**
\`\`\`json
{
  "location": "New York",
  "temperature": "72°F",
  "condition": "Sunny"
}
\`\`\`

Is there anything else you'd like to do?`,
        needsClarification: false,
        executionResult: '{"location": "New York", "temperature": "72°F", "condition": "Sunny"}',
        toolMatch: {
          tool: exampleWeatherTool,
          confidence: 1.0,
          parameters: { location: 'New York', units: 'fahrenheit' }
        }
      };
    }
  }

  async saveConversation(conversationId: string): Promise<void> {
    // Mock save
  }

  getConversationHistory(conversationId: string): any {
    return {
      id: conversationId,
      messages: [
        { id: '1', role: 'assistant', content: 'Hello! I\'m here to help you interact with various APIs. What would you like to do today?', timestamp: new Date() },
        { id: '2', role: 'user', content: 'I want to check the weather', timestamp: new Date() },
        { id: '3', role: 'assistant', content: 'I need location information...', timestamp: new Date() },
        { id: '4', role: 'user', content: 'New York', timestamp: new Date() },
        { id: '5', role: 'assistant', content: 'I need temperature units...', timestamp: new Date() },
        { id: '6', role: 'user', content: 'fahrenheit', timestamp: new Date() }
      ],
      metadata: {
        startTime: new Date(),
        lastActivity: new Date()
      }
    };
  }
}

// Example conversation flow
async function demonstrateConversation() {
  console.log('🚀 Starting Conversational Chat Engine Demo\n');
  console.log('📝 Note: This is a mock demo that simulates the conversational flow without requiring an OpenAI API key.\n');
  
  const chatEngine = new MockEnhancedConversationalChatEngine([exampleWeatherTool]);
  
  // Start a new conversation
  const conversationId = chatEngine.startConversation();
  console.log(`📝 Started conversation: ${conversationId.substring(0, 8)}\n`);
  
  // Example conversation flow
  const conversations = [
    "I want to check the weather",
    "New York", // Response to location question
    "fahrenheit" // Response to units question
  ];
  
  for (const [index, userInput] of conversations.entries()) {
    console.log(`👤 User: ${userInput}`);
    
    try {
      const response = await chatEngine.processMessage(conversationId, userInput);
      console.log(`🤖 Assistant: ${response.message}\n`);
      
      if (response.needsClarification) {
        console.log(`❓ Needs clarification: ${response.clarificationRequest?.type}\n`);
      }
      
      if (response.executionResult) {
        console.log(`✅ Execution completed successfully\n`);
      }
      
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}\n`);
    }
    
    // Add delay between messages for readability
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save the conversation
  await chatEngine.saveConversation(conversationId);
  console.log(`💾 Conversation saved\n`);
  
  // Demonstrate conversation history
  const history = chatEngine.getConversationHistory(conversationId);
  if (history) {
    console.log('📖 Conversation History:');
    history.messages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.role}] ${msg.content}`);
    });
  }
}

// Run the demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateConversation()
    .then(() => {
      console.log('\n🎉 Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Demo failed:', error);
      process.exit(1);
    });
}

export { demonstrateConversation };