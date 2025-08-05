import { EnhancedConversationalEngine } from './EnhancedConversationalEngine.js';
import { ToolLoader } from '../tools/loader.js';
import { MCPTool } from '../types.js';

async function runDemo() {
    console.log('🚀 Enhanced Conversational Chat Demo');
    console.log('=====================================\n');

    // Load tools
    const loader = new ToolLoader();
    const tools = await loader.loadTools('./generated-tools');
    
    // Initialize chat engine with O3 model (if available)
    const chatEngine = new EnhancedConversationalEngine('o3');
    chatEngine.updateTools(tools);

    // Start conversation
    const conversationId = chatEngine.startConversation();

    // Demo scenarios
    const scenarios = [
        {
            name: 'Scenario 1: Missing Required Fields',
            userInput: 'I want to create a pet with id 4 and name leo and category id 3',
            description: 'This should trigger a request for the missing required photoUrls field'
        },
        {
            name: 'Scenario 2: Adding Optional Fields',
            userInput: 'photoUrls https://example.com/photo1.jpg, https://example.com/photo2.jpg',
            description: 'This should complete the required fields and suggest optional ones'
        },
        {
            name: 'Scenario 3: Adding Optional Tags',
            userInput: 'tags friendly, playful',
            description: 'This should add optional tags and execute the request'
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n📋 ${scenario.name}`);
        console.log(`Description: ${scenario.description}`);
        console.log(`User Input: "${scenario.userInput}"`);
        console.log('\n🤖 Assistant Response:');
        
        try {
            const response = await chatEngine.processMessage(conversationId, scenario.userInput);
            console.log(response.message);
            
            if (response.needsClarification) {
                console.log('\n💡 Clarification needed!');
            }
            
            if (response.executionResult) {
                console.log('\n✅ Execution completed!');
            }
        } catch (error) {
            console.error('❌ Error:', error);
        }
        
        console.log('\n' + '='.repeat(50));
    }

    console.log('\n🎉 Demo completed!');
}

// Run the demo
runDemo().catch(console.error); 