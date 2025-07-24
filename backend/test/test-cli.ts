import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_SPEC = join(__dirname, 'specs/petstore.json');

async function runCliTest() {
  return new Promise((resolve) => {
    console.log('🚀 Starting CLI Test');
    
    const child = spawn('node', ['dist/mcp-gpt-bridge.js', TEST_SPEC], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DEBUG: '*' // Enable debug output
      }
    });
    
    let output = '';
    let isReady = false;
    
    // Collect output
    child.stdout.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      process.stdout.write(dataStr);
      
      // Check if the CLI is ready
      if (!isReady && (output.includes('MCP server running') || output.includes('> '))) {
        isReady = true;
        console.log('✅ CLI started successfully');
        child.kill();
        resolve(true);
      }
    });
    
    child.stderr.on('data', (data) => {
      const errorStr = data.toString();
      process.stderr.write(errorStr);
      output += `[ERROR] ${errorStr}`;
    });
    
    // Set timeout
    const timeout = setTimeout(() => {
      console.log('❌ Test timed out');
      console.log('Current output:', output);
      child.kill();
      resolve(false);
    }, 15000); // Increased timeout to 15 seconds
    
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      if (!isReady) {
        console.log(`❌ Process exited with code ${code} and signal ${signal}`);
        console.log('Output before exit:', output);
        resolve(false);
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      console.error('❌ Child process error:', error);
      console.log('Output before error:', output);
      resolve(false);
    });
    
    // Send a newline to trigger the prompt after a short delay
    setTimeout(() => {
      if (!isReady) {
        console.log('Sending newline to trigger prompt...');
        child.stdin.write('\n');
      }
    }, 2000);
  });
}

async function main() {
  console.log('🚀 Starting CLI Tests\n');
  
  const success = await runCliTest();
  
  console.log('\n📊 Test Results:');
  console.log(success ? '✅ All tests passed' : '❌ Some tests failed');
  
  process.exit(success ? 0 : 1);
}

main().catch(console.error);
