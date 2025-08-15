#!/usr/bin/env node

/**
 * Test Existing Tools with ChromaDB
 * 
 * This script:
 * 1. Loads existing tools from generated-tools/ directory
 * 2. Generates embeddings for them
 * 3. Stores them in ChromaDB
 * 4. Tests semantic search
 * 5. Cleans up test data
 */

import OpenAI from 'openai';
import { ChromaClient } from 'chromadb';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

async function loadExistingTools() {
  const toolsDir = './generated-tools';
  
  if (!existsSync(toolsDir)) {
    console.log('❌ generated-tools directory not found');
    return [];
  }
  
  const toolFiles = readdirSync(toolsDir).filter(file => file.endsWith('.json'));
  console.log(`📁 Found ${toolFiles.length} tool files`);
  
  const tools = [];
  for (const file of toolFiles.slice(0, 10)) { // Limit to first 10 tools for testing
    try {
      const toolPath = join(toolsDir, file);
      const toolContent = readFileSync(toolPath, 'utf-8');
      const tool = JSON.parse(toolContent);
      tools.push(tool);
    } catch (error) {
      console.error(`❌ Failed to load tool ${file}:`, error.message);
    }
  }
  
  return tools;
}

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

async function testExistingTools() {
  console.log('🧪 Testing Existing Tools with ChromaDB');
  console.log('=======================================\n');

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
    // Test 1: Load existing tools
    console.log('1️⃣ Loading existing tools...');
    const tools = await loadExistingTools();
    
    if (tools.length === 0) {
      console.log('❌ No tools found to test');
      return;
    }
    
    console.log(`✅ Loaded ${tools.length} tools for testing`);

    // Test 2: Initialize ChromaDB
    console.log('\n2️⃣ Initializing ChromaDB...');
    const toolsCollection = await chromaClient.getOrCreateCollection({
      name: 'existing_tools_test',
      metadata: { description: 'Test collection for existing tools' }
    });
    console.log('✅ ChromaDB collection created');

    // Test 3: Generate and store embeddings
    console.log('\n3️⃣ Generating embeddings for existing tools...');
    const toolIds = [];
    const toolEmbeddings = [];
    const toolMetadatas = [];
    const toolDocuments = [];

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      
      // Create a text representation of the tool
      const toolText = [
        tool.name || 'unnamed',
        tool.description || '',
        tool.annotations?.method || '',
        tool.annotations?.path || '',
        (tool.annotations?.tags || []).join(' ')
      ].filter(Boolean).join(' ');
      
      console.log(`   Generating embedding for: ${tool.name || `tool_${i + 1}`}`);
      
      try {
        const embedding = await generateEmbedding(toolText, openai);
        
        const toolId = `existing_tool_${i + 1}`;
        toolIds.push(toolId);
        toolEmbeddings.push(embedding);
        toolMetadatas.push({
          name: tool.name || `tool_${i + 1}`,
          description: tool.description || 'No description',
          method: tool.annotations?.method || 'UNKNOWN',
          path: tool.annotations?.path || 'No path',
          tags: (tool.annotations?.tags || []).join(','), // Convert array to comma-separated string
          createdAt: new Date().toISOString()
        });
        toolDocuments.push(JSON.stringify(tool));
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`   ❌ Failed to generate embedding for tool ${i + 1}:`, error.message);
      }
    }

    if (toolEmbeddings.length === 0) {
      console.log('❌ No embeddings generated successfully');
      return;
    }

    console.log(`✅ Generated ${toolEmbeddings.length} embeddings`);

    // Test 4: Store embeddings in ChromaDB
    console.log('\n4️⃣ Storing embeddings in ChromaDB...');
    await toolsCollection.add({
      ids: toolIds,
      embeddings: toolEmbeddings,
      metadatas: toolMetadatas,
      documents: toolDocuments
    });
    console.log('✅ Embeddings stored successfully');

    // Test 5: Perform semantic searches
    console.log('\n5️⃣ Testing semantic search with real tools...');
    
    const searchQueries = [
      'get pet information',
      'create new pet',
      'update pet status',
      'delete pet record',
      'find pets by status',
      'search for available pets',
      'user management',
      'order processing',
      'inventory check',
      'weather information'
    ];

    for (const query of searchQueries) {
      console.log(`\n🔍 Searching for: "${query}"`);
      
      try {
        // Generate embedding for the query
        const queryEmbedding = await generateEmbedding(query, openai);
        
        // Search for similar tools
        const results = await toolsCollection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: 3,
          include: ['metadatas', 'distances']
        });

        if (results.ids[0] && results.ids[0].length > 0) {
          console.log('   Top matches:');
          results.ids[0].forEach((id, index) => {
            const metadata = results.metadatas[0][index];
            const distance = results.distances[0][index];
            const similarity = 1 - distance; // Convert distance to similarity
            
            console.log(`   ${index + 1}. ${metadata.name} (similarity: ${(similarity * 100).toFixed(1)}%)`);
            console.log(`      Method: ${metadata.method} | Path: ${metadata.path}`);
            if (metadata.tags && metadata.tags !== '') {
              console.log(`      Tags: ${metadata.tags}`);
            }
          });
        } else {
          console.log('   No matches found');
        }
        
        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`   ❌ Search failed for "${query}":`, error.message);
      }
    }

    // Test 6: Test specific API scenarios
    console.log('\n6️⃣ Testing specific API scenarios...');
    
    const apiScenarios = [
      {
        name: 'Pet Store Operations',
        query: 'I want to work with pets in the store',
        expectedKeywords: ['pet', 'store', 'animal']
      },
      {
        name: 'User Management',
        query: 'How do I manage user accounts?',
        expectedKeywords: ['user', 'account', 'profile']
      },
      {
        name: 'Order Processing',
        query: 'I need to handle orders and inventory',
        expectedKeywords: ['order', 'inventory', 'store']
      },
      {
        name: 'Data Retrieval',
        query: 'Get information from the system',
        expectedKeywords: ['get', 'find', 'search', 'retrieve']
      }
    ];

    for (const scenario of apiScenarios) {
      console.log(`\n📋 Scenario: ${scenario.name}`);
      console.log(`   Query: "${scenario.query}"`);
      
      try {
        const queryEmbedding = await generateEmbedding(scenario.query, openai);
        const results = await toolsCollection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: 5,
          include: ['metadatas', 'distances']
        });

        if (results.ids[0] && results.ids[0].length > 0) {
          console.log('   Results:');
          results.ids[0].forEach((id, index) => {
            const metadata = results.metadatas[0][index];
            const distance = results.distances[0][index];
            const similarity = 1 - distance;
            
            console.log(`   ${index + 1}. ${metadata.name} (${(similarity * 100).toFixed(1)}%)`);
            console.log(`      ${metadata.description}`);
          });
        } else {
          console.log('   No results found');
        }
      } catch (error) {
        console.error(`   ❌ Scenario test failed:`, error.message);
      }
    }

    // Test 7: Clean up test data
    console.log('\n7️⃣ Cleaning up test data...');
    await toolsCollection.delete({ ids: toolIds });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests completed successfully!');
    console.log('\nSummary:');
    console.log(`- Loaded ${tools.length} existing tools`);
    console.log(`- Generated ${toolEmbeddings.length} embeddings`);
    console.log(`- Stored embeddings in ChromaDB`);
    console.log(`- Tested ${searchQueries.length} search queries`);
    console.log(`- Tested ${apiScenarios.length} API scenarios`);
    console.log(`- Cleaned up test data`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nStack trace:', error.stack);
    
    // Provide helpful debugging information
    console.log('\n🔧 Debugging Tips:');
    console.log('1. Ensure ChromaDB server is running on port 8000');
    console.log('2. Check if you can access: http://localhost:8000/api/v2/heartbeat');
    console.log('3. Verify your OpenAI API key is set correctly');
    console.log('4. Check the generated-tools directory exists and contains JSON files');
    console.log('5. Check the ChromaDB logs for any server-side errors');
    
    process.exit(1);
  }
}

// Run the test
testExistingTools().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
