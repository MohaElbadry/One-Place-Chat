#!/usr/bin/env node

/**
 * Simple Embedding Test Script
 * 
 * This script tests the embedding functionality with ChromaDB:
 * 1. Generate embeddings for sample tools
 * 2. Store them in ChromaDB
 * 3. Perform semantic search
 * 4. Clean up test data
 */

import OpenAI from 'openai';
import { ChromaClient } from 'chromadb';

// Sample tools for testing
const sampleTools = [
  {
    name: 'get_user_info',
    description: 'Retrieve user information by user ID',
    method: 'GET',
    path: '/users/{userId}',
    tags: ['user', 'read', 'profile']
  },
  {
    name: 'create_user',
    description: 'Create a new user account',
    method: 'POST',
    path: '/users',
    tags: ['user', 'create', 'account']
  },
  {
    name: 'update_user_profile',
    description: 'Update user profile information',
    method: 'PUT',
    path: '/users/{userId}/profile',
    tags: ['user', 'update', 'profile']
  },
  {
    name: 'delete_user',
    description: 'Remove a user account permanently',
    method: 'DELETE',
    path: '/users/{userId}',
    tags: ['user', 'delete', 'account']
  },
  {
    name: 'get_user_posts',
    description: 'Fetch all posts created by a specific user',
    method: 'GET',
    path: '/users/{userId}/posts',
    tags: ['user', 'posts', 'content', 'read']
  },
  {
    name: 'search_users',
    description: 'Search for users by name, email, or other criteria',
    method: 'GET',
    path: '/users/search',
    tags: ['user', 'search', 'query']
  }
];

async function generateEmbedding(text, openai) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

async function testEmbeddings() {
  console.log('🧪 Testing Embedding Generation and Storage');
  console.log('==========================================\n');

  // Check if OpenAI API key is available
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log('❌ OPENAI_API_KEY environment variable not set');
    console.log('Please set your OpenAI API key: export OPENAI_API_KEY=your_key_here');
    return;
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const chromaClient = new ChromaClient({ path: 'http://localhost:8000' });

  try {
    // Test 1: Initialize ChromaDB
    console.log('1️⃣ Initializing ChromaDB...');
    const toolsCollection = await chromaClient.getOrCreateCollection({
      name: 'test_tools',
      metadata: { description: 'Test tools for embedding demo' }
    });
    console.log('✅ ChromaDB collection created');

    // Test 2: Generate and store embeddings
    console.log('\n2️⃣ Generating embeddings for sample tools...');
    const toolIds = [];
    const toolEmbeddings = [];
    const toolMetadatas = [];
    const toolDocuments = [];

    for (let i = 0; i < sampleTools.length; i++) {
      const tool = sampleTools[i];
      const toolText = `${tool.name} ${tool.description} ${tool.method} ${tool.path} ${tool.tags.join(' ')}`;
      
      console.log(`   Generating embedding for: ${tool.name}`);
      const embedding = await generateEmbedding(toolText, openai);
      
      const toolId = `test_tool_${i + 1}`;
      toolIds.push(toolId);
      toolEmbeddings.push(embedding);
      toolMetadatas.push({
        name: tool.name,
        description: tool.description,
        method: tool.method,
        path: tool.path,
        tags: tool.tags,
        createdAt: new Date().toISOString()
      });
      toolDocuments.push(JSON.stringify(tool));
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Generated ${toolEmbeddings.length} embeddings`);

    // Test 3: Store embeddings in ChromaDB
    console.log('\n3️⃣ Storing embeddings in ChromaDB...');
    await toolsCollection.add({
      ids: toolIds,
      embeddings: toolEmbeddings,
      metadatas: toolMetadatas,
      documents: toolDocuments
    });
    console.log('✅ Embeddings stored successfully');

    // Test 4: Perform semantic searches
    console.log('\n4️⃣ Testing semantic search...');
    
    const searchQueries = [
      'find user information',
      'create new account',
      'modify profile details',
      'remove user data',
      'get user content',
      'search for people'
    ];

    for (const query of searchQueries) {
      console.log(`\n🔍 Searching for: "${query}"`);
      
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query, openai);
      
      // Search for similar tools
      const results = await toolsCollection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 3,
        include: ['metadatas', 'documents', 'distances']
      });

      console.log('   Top matches:');
      results.ids[0].forEach((id, index) => {
        const metadata = results.metadatas[0][index];
        const distance = results.distances[0][index];
        const similarity = 1 - distance; // Convert distance to similarity
        
        console.log(`   ${index + 1}. ${metadata.name} (similarity: ${(similarity * 100).toFixed(1)}%)`);
        console.log(`      ${metadata.description}`);
      });
    }

    // Test 5: Test specific use cases
    console.log('\n5️⃣ Testing specific use cases...');
    
    const useCases = [
      {
        name: 'User Management',
        query: 'I need to manage user accounts',
        expectedTools: ['create_user', 'update_user_profile', 'delete_user']
      },
      {
        name: 'Information Retrieval',
        query: 'How can I get user data?',
        expectedTools: ['get_user_info', 'get_user_posts', 'search_users']
      },
      {
        name: 'Content Creation',
        query: 'I want to add new users to the system',
        expectedTools: ['create_user']
      },
      {
        name: 'Data Cleanup',
        query: 'Remove old user accounts',
        expectedTools: ['delete_user']
      }
    ];

    for (const useCase of useCases) {
      console.log(`\n📋 Use Case: ${useCase.name}`);
      console.log(`   Query: "${useCase.query}"`);
      
      const queryEmbedding = await generateEmbedding(useCase.query, openai);
      const results = await toolsCollection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 5,
        include: ['metadatas', 'distances']
      });

      console.log('   Results:');
      results.ids[0].forEach((id, index) => {
        const metadata = results.metadatas[0][index];
        const distance = results.distances[0][index];
        const similarity = 1 - distance;
        
        console.log(`   ${index + 1}. ${metadata.name} (${(similarity * 100).toFixed(1)}%)`);
      });
    }

    // Test 6: Clean up test data
    console.log('\n6️⃣ Cleaning up test data...');
    await toolsCollection.delete({ ids: toolIds });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests completed successfully!');
    console.log('\nSummary:');
    console.log(`- Generated ${sampleTools.length} tool embeddings`);
    console.log(`- Stored embeddings in ChromaDB`);
    console.log(`- Tested ${searchQueries.length} search queries`);
    console.log(`- Tested ${useCases.length} specific use cases`);
    console.log(`- Cleaned up test data`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nStack trace:', error.stack);
    
    // Provide helpful debugging information
    console.log('\n🔧 Debugging Tips:');
    console.log('1. Ensure ChromaDB server is running on port 8000');
    console.log('2. Check if you can access: http://localhost:8000/api/v2/heartbeat');
    console.log('3. Verify your OpenAI API key is set correctly');
    console.log('4. Check the ChromaDB logs for any server-side errors');
    
    process.exit(1);
  }
}

// Run the test
testEmbeddings().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
