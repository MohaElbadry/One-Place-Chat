#!/usr/bin/env node

/**
 * Basic Setup Test
 * 
 * This script tests the basic setup:
 * 1. ChromaDB server connection
 * 2. OpenAI API key availability
 * 3. Basic functionality
 */

async function testBasicSetup() {
  console.log('🧪 Testing Basic Setup');
  console.log('======================\n');

  // Test 1: Check OpenAI API key
  console.log('1️⃣ Checking OpenAI API key...');
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log('❌ OPENAI_API_KEY environment variable not set');
    console.log('Please set your OpenAI API key: export OPENAI_API_KEY=your_key_here');
    return;
  }
  console.log('✅ OpenAI API key is set');

  // Test 2: Check ChromaDB server
  console.log('\n2️⃣ Checking ChromaDB server...');
  try {
    const response = await fetch('http://localhost:8000/api/v2/heartbeat');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ ChromaDB server is running');
      console.log(`   Response: ${JSON.stringify(data)}`);
    } else {
      console.log(`❌ ChromaDB server responded with status: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ ChromaDB server is not accessible');
    console.log('   Error:', error.message);
    console.log('\n   To start ChromaDB server:');
    console.log('   docker-compose -f docker-compose.chromadb.yml up -d');
  }

  // Test 3: Check if we can import modules
  console.log('\n3️⃣ Checking module imports...');
  try {
    const openaiModule = await import('openai');
    console.log('✅ OpenAI module imported successfully');
    
    // Test OpenAI client creation
    const openai = new openaiModule.default({ apiKey: openaiKey });
    console.log('✅ OpenAI client created successfully');
    
  } catch (error) {
    console.log('❌ Failed to import OpenAI module:', error.message);
    console.log('   Please run: npm install');
  }

  // Test 4: Check file system access
  console.log('\n4️⃣ Checking file system access...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // Check if generated-tools directory exists
    const toolsDir = './generated-tools';
    if (fs.existsSync(toolsDir)) {
      const files = fs.readdirSync(toolsDir).filter(file => file.endsWith('.json'));
      console.log(`✅ Generated tools directory found with ${files.length} tool files`);
    } else {
      console.log('⚠️ Generated tools directory not found');
      console.log('   Run: npm run generate-tools api-docs/Petstore/swagger.json');
    }
    
  } catch (error) {
    console.log('❌ File system access failed:', error.message);
  }

  console.log('\n🎉 Basic setup test completed!');
  
  if (openaiKey) {
    console.log('\nNext steps:');
    console.log('1. Ensure ChromaDB server is running');
    console.log('2. Run: npm run test-embeddings-simple');
    console.log('3. Or run: npm run test-existing-tools');
  }
}

// Run the test
testBasicSetup().catch(error => {
  console.error('❌ Basic setup test failed:', error);
  process.exit(1);
});
