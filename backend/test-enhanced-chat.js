#!/usr/bin/env node

import { EnhancedConversationalEngine } from './dist/utils/EnhancedConversationalEngine.js';
import { ToolLoader } from './dist/tools/loader.js';

async function testEnhancedChat() {
    console.log('🚀 Testing Enhanced Conversational Chat');
    console.log('=======================================\n');

    // Load tools
    const loader = new ToolLoader();
    const tools = await loader.loadTools('./generated-tools');
    
    // Initialize chat engine
    const chatEngine = new EnhancedConversationalEngine('gpt-4');
    chatEngine.updateTools(tools);

    // Start conversation
    const conversationId = chatEngine.startConversation();

    // Test scenarios
    const testScenarios = [
        {
            name: 'Scenario 1: Create pet with missing required fields',
            input: 'I want to create a pet with name leo and id 4',
            expected: 'Should ask for photoUrls (required field)'
        },
        {
            name: 'Scenario 2: Provide missing required field',
            input: 'photoUrls https://example.com/photo1.jpg',
            expected: 'Should have all required fields and suggest optional ones'
        },
        {
            name: 'Scenario 3: Add optional fields',
            input: 'tags friendly, playful and status available',
            expected: 'Should execute the API call with all parameters'
        }
    ];

    for (const scenario of testScenarios) {
        console.log(`\n📋 ${scenario.name}`);
        console.log(`Input: "${scenario.input}"`);
        console.log(`Expected: ${scenario.expected}`);
        console.log('\n🤖 Response:');
        
        try {
            const response = await chatEngine.processMessage(conversationId, scenario.input);
            console.log(response.message);
            
            if (response.needsClarification) {
                console.log('💡 Clarification needed!');
            }
            
            if (response.executionResult) {
                console.log('✅ Execution completed!');
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
        
        console.log('\n' + '='.repeat(60));
    }

    console.log('\n🎉 Test completed!');
}

// Run the test
testEnhancedChat().catch(console.error); 