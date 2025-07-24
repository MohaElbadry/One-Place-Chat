import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { MCPToolGenerator } from '../src/utils/generator';

async function testToolGeneration(specPath: string) {
  try {
    console.log(`\n🔍 Testing tool generation with: ${specPath}`);
    
    // Initialize the tool generator
    const generator = new MCPToolGenerator();
    
    // Generate tools from the specification file
    const result = await generator.generateMCPTools(specPath);
    
    console.log(`✅ Successfully generated ${result.tools.length} tools`);
    console.log('📋 Tool names:');
    result.tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name} - ${tool.description || 'No description'}`);
    });
    
    return result.tools.length > 0;
  } catch (error) {
    console.error('❌ Error during tool generation:', error);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting MCP GPT Bridge Tests\n');
  
  // Test with Petstore API
  const petstoreResult = await testToolGeneration(join(__dirname, 'specs/petstore.json'));
  
  console.log('\n📊 Test Results:');
  console.log(`- Petstore API: ${petstoreResult ? '✅ PASSED' : '❌ FAILED'}`);
  
  // Add more test cases as needed
  
  process.exit(0);
}

runTests();
