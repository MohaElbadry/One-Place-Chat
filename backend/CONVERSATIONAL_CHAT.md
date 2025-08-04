# Conversational Chat System

This document explains the new conversational chat system that makes your LLM interactions more natural and context-aware.

## 🌟 Features

### 1. **Conversation Context Management**
- **Memory**: Remembers previous messages and context
- **Persistence**: Saves conversations across sessions
- **History**: Access to full conversation history
- **State Management**: Tracks ongoing conversation state

### 2. **Missing Information Detection**
- **Smart Analysis**: Automatically detects missing required parameters
- **Context Awareness**: Uses conversation history to avoid asking for already provided information
- **Intelligent Extraction**: Extracts information from natural language input

### 3. **Clarification Engine**
- **Follow-up Questions**: Asks specific questions for missing information
- **Validation**: Validates user responses against expected formats
- **Examples**: Provides examples and possible values for parameters
- **Error Handling**: Gives helpful error messages for invalid responses

### 4. **Enhanced User Experience**
- **Natural Flow**: Conversations flow naturally like chatting with a human
- **Context Preservation**: No need to repeat information in each message
- **Session Management**: Resume previous conversations
- **Conversation Switching**: Easily switch between multiple conversations

## 🚀 Getting Started

### Running the Conversational Chat

```bash
# Start the enhanced chat interface
npm run chat

# Run the demo to see how it works
npm run chat-demo
```

### Basic Usage Flow

1. **Start a conversation** - The system will greet you and start a new conversation
2. **Make a request** - Describe what you want to do in natural language
3. **Provide missing info** - If information is missing, the LLM will ask specific questions
4. **Confirm execution** - Review and approve the API call
5. **Continue chatting** - Ask follow-up questions or make new requests

## 💬 Example Conversation

```
🤖 Assistant: Hello! I'm here to help you interact with various APIs. What would you like to do today?

👤 User: I want to check the weather

🤖 Assistant: I'd be happy to help you with that! To use the get_weather API, I need 2 more pieces of information:

1. What is the location? (e.g., New York, San Francisco)
2. Temperature units? Choose from: celsius, fahrenheit

Please provide these details so I can complete your request.

👤 User: 1. New York
2. fahrenheit

🤖 Assistant: ✅ API call executed successfully!

**Response:**
```json
{
  "location": "New York",
  "temperature": "72°F",
  "condition": "Sunny"
}
```

Is there anything else you'd like to do?

👤 User: What about the weather in London?

🤖 Assistant: I'll get the weather for London using the same temperature units (fahrenheit) from our previous conversation.
```

## 🏗️ Architecture

### Core Components

1. **ConversationManager** (`src/utils/ConversationManager.ts`)
   - Manages conversation lifecycle
   - Handles message storage and retrieval
   - Provides conversation persistence

2. **MissingInfoDetector** (`src/utils/MissingInfoDetector.ts`)
   - Analyzes user input for missing parameters
   - Generates intelligent clarification questions
   - Validates user responses

3. **ConversationalChatEngine** (`src/utils/ConversationalChatEngine.ts`)
   - Orchestrates the entire conversation flow
   - Manages state transitions
   - Handles tool execution

4. **Enhanced ChatInterface** (`src/cli/chat-interface.ts`)
   - Provides the user interface
   - Handles conversation switching
   - Manages user interactions

### Data Flow

```
User Input → ConversationalChatEngine
    ↓
MissingInfoDetector → Analyze for missing info
    ↓
If missing info → Generate clarification questions
    ↓
User Response → Validate and extract information
    ↓
All info complete → Execute API call
    ↓
ConversationManager → Save conversation state
```

## 🔧 Configuration

### Environment Variables

```bash
# Required for AI-powered information extraction
OPENAI_API_KEY=your_openai_api_key_here
```

### Conversation Storage

Conversations are automatically saved to `./conversations/` directory as JSON files.

### Customization

You can customize the behavior by:

1. **Modifying conversation prompts** in `MissingInfoDetector.ts`
2. **Adjusting validation rules** for specific field types
3. **Changing storage location** in `ConversationManager.ts`
4. **Adding custom information extractors** for domain-specific data

## 🎯 Key Benefits

### For Users
- **Natural interaction**: Chat like you would with a human assistant
- **No repetition**: Context is remembered throughout the conversation
- **Guided assistance**: Get help when information is missing
- **Session continuity**: Resume conversations across sessions

### For Developers
- **Modular design**: Easy to extend and customize
- **Type safety**: Full TypeScript support
- **Testable**: Each component can be tested independently
- **Scalable**: Supports multiple concurrent conversations

## 🔄 Conversation States

The system manages several conversation states:

1. **New Conversation**: Starting fresh with welcome message
2. **Awaiting Input**: Normal chat flow, processing user requests
3. **Clarification Mode**: Asking for missing information
4. **Validation**: Checking user responses against expected formats
5. **Execution**: Running API calls with complete information
6. **Complete**: Waiting for next user request

## 🛠️ API Reference

### ConversationalChatEngine

```typescript
// Start a new conversation
const conversationId = chatEngine.startConversation();

// Process user message
const response = await chatEngine.processMessage(conversationId, userInput);

// Save conversation
await chatEngine.saveConversation(conversationId);

// Load existing conversation
const conversation = await chatEngine.loadConversation(conversationId);
```

### Response Interface

```typescript
interface ChatResponse {
  message: string;                      // Assistant's response message
  needsClarification: boolean;          // Whether clarification is needed
  clarificationRequest?: ClarificationRequest;  // Details about missing info
  toolMatch?: {                         // Information about matched tool
    tool: MCPTool;
    confidence: number;
    parameters: Record<string, any>;
  };
  suggestions?: string[];               // Alternative suggestions
  executionResult?: any;                // API call result if executed
}
```

## 🧪 Testing

Run the demo to see the conversational system in action:

```bash
npm run chat-demo
```

This will demonstrate:
- Starting a conversation
- Detecting missing information
- Asking clarification questions
- Processing responses
- Executing API calls
- Saving conversation history

## 🔮 Future Enhancements

Potential improvements for the conversational system:

1. **Multi-turn planning**: Handle complex requests that require multiple API calls
2. **Context switching**: Seamlessly switch between different topics
3. **Learning**: Improve over time based on user interactions
4. **Integration**: Connect with external knowledge bases
5. **Personalization**: Learn user preferences and adjust behavior
6. **Voice support**: Add speech-to-text and text-to-speech capabilities

## 🤝 Contributing

When contributing to the conversational system:

1. **Maintain context awareness**: Always consider conversation history
2. **Provide helpful error messages**: Make validation errors clear and actionable
3. **Test conversation flows**: Ensure natural conversation progression
4. **Document new features**: Update this README for any new capabilities

## 📞 Support

For questions about the conversational chat system:

1. Check the example conversation demo
2. Review the type definitions in `src/types.ts`
3. Examine the test cases and examples
4. Create an issue for specific problems or feature requests

---

The conversational chat system transforms your API interactions from simple request-response patterns into natural, context-aware conversations that feel like chatting with an intelligent assistant.