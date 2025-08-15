#!/usr/bin/env node

/**
 * ChromaDB Integration Test Script
 * 
 * This script tests the ChromaDB integration to ensure everything is working correctly.
 */

import { ChromaDBService } from '../src/database/ChromaDBService.js';
import { ToolEmbeddingMatcherChroma } from '../src/tools/ToolEmbeddingMatcherChroma.js';
import { ConversationStoreChroma } from '../src/core/ConversationStoreChroma.js';

async function testChromaDBIntegration() {
  console.log('🧪 Testing ChromaDB Integration');
  console.log('================================\n');

  let chromaService;
  let toolMatcher;
  let conversationStore;

  try {
    // Test 1: Initialize ChromaDB Service
    console.log('1️⃣ Testing ChromaDB Service Initialization...');
    chromaService = new ChromaDBService();
    await chromaService.initialize();
    console.log('✅ ChromaDB Service initialized successfully');

    // Test 2: Test Database Stats
    console.log('\n2️⃣ Testing Database Statistics...');
    const stats = await chromaService.getDatabaseStats();
    console.log('📊 Database Stats:', stats);

    // Test 3: Test Tool Embedding Matcher
    console.log('\n3️⃣ Testing Tool Embedding Matcher...');
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.log('⚠️ OpenAI API key not set, skipping embedding tests');
    } else {
      toolMatcher = new ToolEmbeddingMatcherChroma(openaiKey, chromaService);
      
      // Create a mock tool for testing
      const mockTool = {
        name: 'test_get_user',
        description: 'Get user information by ID',
        inputSchema: { type: 'object', properties: { userId: { type: 'string' } } },
        annotations: {
          method: 'GET',
          path: '/user/{userId}',
          tags: ['user', 'read'],
          deprecated: false,
          title: 'Get User',
          openWorldHint: false,
          readOnlyHint: true
        },
        endpoint: {
          method: 'GET',
          path: '/user/{userId}',
          baseUrl: 'https://api.example.com',
          parameters: [
            {
              name: 'userId',
              in: 'path',
              required: true,
              description: 'User ID',
              type: 'string'
            }
          ]
        },
        security: [],
        execute: async () => ({ success: true })
      };

      await toolMatcher.initialize([mockTool]);
      console.log('✅ Tool Embedding Matcher initialized successfully');

      // Test tool search
      const similarTools = await toolMatcher.findSimilarTools('get user info', 3);
      console.log(`🔍 Found ${similarTools.length} similar tools`);
    }

    // Test 4: Test Conversation Store
    console.log('\n4️⃣ Testing Conversation Store...');
    conversationStore = new ConversationStoreChroma(chromaService);
    await conversationStore.initialize();
    console.log('✅ Conversation Store initialized successfully');

    // Test conversation creation
    const conversation = conversationStore.createConversation('test-user');
    console.log(`💬 Created conversation: ${conversation.id}`);

    // Test message addition
    const message = conversationStore.addMessage(conversation.id, 'user', 'Hello, this is a test message');
    console.log(`📝 Added message: ${message.id}`);

    // Test conversation retrieval
    const retrievedConversation = conversationStore.getConversation(conversation.id);
    console.log(`📖 Retrieved conversation with ${retrievedConversation?.messages.length} messages`);

    // Test conversation listing
    const conversations = await conversationStore.listConversations();
    console.log(`📚 Total conversations: ${conversations.length}`);

    // Test conversation stats
    const conversationStats = await conversationStore.getConversationStats();
    console.log('📊 Conversation Stats:', conversationStats);

    // Test 5: Test Search Functionality
    console.log('\n5️⃣ Testing Search Functionality...');
    const searchResults = await conversationStore.searchConversations('test message', 3);
    console.log(`🔍 Search results: ${searchResults.length} conversations found`);

    // Test 6: Test Cleanup
    console.log('\n6️⃣ Testing Cleanup...');
    await conversationStore.deleteConversation(conversation.id);
    console.log('🗑️ Test conversation deleted successfully');

    console.log('\n🎉 All tests passed successfully!');
    console.log('\nChromaDB integration is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nStack trace:', error.stack);
    
    // Provide helpful debugging information
    console.log('\n🔧 Debugging Tips:');
    console.log('1. Ensure ChromaDB server is running on port 8000');
    console.log('2. Check if you can access: http://localhost:8000/api/v1/heartbeat');
    console.log('3. Verify your OpenAI API key is set (if testing embeddings)');
    console.log('4. Check the ChromaDB logs for any server-side errors');
    
    process.exit(1);
  } finally {
    // Cleanup
    if (toolMatcher) {
      await toolMatcher.close();
    }
    if (conversationStore) {
      await conversationStore.close();
    }
    if (chromaService) {
      await chromaService.close();
    }
  }
}

// Run the tests
testChromaDBIntegration().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
