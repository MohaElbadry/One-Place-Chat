import * as readline from 'readline';
import { MCPGPTBridge } from '../bridge/MCPGPTBridge.js';

export class InteractiveCLI {
  private rl: readline.Interface;
  private bridge: MCPGPTBridge;

  constructor(bridge: MCPGPTBridge) {
    this.bridge = bridge;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  private askQuestion(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async start(): Promise<void> {
    console.log('\n🎯 MCP → GPT Bridge Interactive Session');
    console.log('=====================================');
    console.log('Available commands:');
    console.log('  📋 list          - Show available tools');
    console.log('  🔧 use <tool>    - Use a specific tool');
    console.log('  ❓ help          - Show this help');
    console.log('  👋 quit          - Exit');
    console.log('=====================================');

    while (true) {
      try {
        const command = await this.askQuestion('\n🤖 > ');
        
        if (command.toLowerCase().trim() === 'quit') {
          console.log('👋 Goodbye!');
          break;
        }
        
        if (command.toLowerCase().trim() === 'help') {
          this.showHelp();
          continue;
        }
        
        if (command.toLowerCase().trim() === 'list') {
          this.showTools();
          continue;
        }
        
        if (command.toLowerCase().startsWith('use ')) {
          const toolName = command.substring(4).trim();
          await this.useTool(toolName);
          continue;
        }
        
        console.log('❌ Unknown command. Type "help" for available commands.');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  private showHelp(): void {
    console.log('\n📖 Help:');
    console.log('  list           - Shows all available API tools from your OpenAPI spec');
    console.log('  use <tool>     - Starts workflow with the specified tool');
    console.log('  quit           - Exits the application');
    console.log('\nWorkflow: tool → cURL generation → GPT analysis');
  }

  private showTools(): void {
    const tools = this.bridge.getTools();
    if (tools.length === 0) {
      console.log('❌ No tools available');
      return;
    }

    console.log('\n📋 Available Tools:');
    console.log('==================');
    tools.forEach((tool, index) => {
      console.log(`${index + 1}. 🔧 ${tool.name}`);
      console.log(`   📝 ${tool.description}`);
      if (tool.inputSchema?.properties) {
        const params = Object.keys(tool.inputSchema.properties)
          .filter(key => !key.startsWith('_'))
          .join(', ');
        console.log(`   📊 Parameters: ${params || 'none'}`);
      }
      console.log('');
    });
  }

  private async useTool(toolName: string): Promise<void> {
    const tools = this.bridge.getTools();
    const tool = tools.find(t => t.name === toolName || t.name.includes(toolName));
    
    if (!tool) {
      console.log(`❌ Tool "${toolName}" not found`);
      console.log('💡 Use "list" to see available tools');
      return;
    }
    
    console.log(`\n🔧 Using tool: ${tool.name}`);
    console.log(`📝 Description: ${tool.description}`);
    
    // Collect parameters
    const parameters: Record<string, any> = {};
    if (tool.inputSchema?.properties) {
      console.log('\n📊 Please provide parameters:');
      
      for (const [paramName, paramDef] of Object.entries(tool.inputSchema.properties as Record<string, any>)) {
        if (paramName.startsWith('_')) continue; // Skip internal params
        
        const isRequired = tool.inputSchema.required?.includes(paramName);
        const requiredText = isRequired ? ' (required)' : ' (optional)';
        const description = paramDef.description ? ` - ${paramDef.description}` : '';
        
        const value = await this.askQuestion(`   ${paramName}${requiredText}${description}: `);
        
        if (value.trim()) {
          // Try to parse as JSON for complex types, otherwise use as string
          try {
            if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
              parameters[paramName] = JSON.parse(value.trim());
            } else {
              parameters[paramName] = value.trim();
            }
          } catch {
            parameters[paramName] = value.trim();
          }
        } else if (isRequired) {
          console.log(`❌ Required parameter "${paramName}" cannot be empty`);
          return;
        }
      }
    }
    
    const userQuestion = await this.askQuestion('\n❓ What would you like to know about this API call? ');
    
    if (!userQuestion.trim()) {
      console.log('❌ Please provide a question about the API call');
      return;
    }
    
    try {
      console.log('\n⏳ Processing...');
      const result = await this.bridge.processWorkflow(tool.name, parameters, userQuestion.trim());
      console.log('\n✅ Results:');
      console.log('==========');
      console.log(result);
    } catch (error) {
      console.error('❌ Workflow failed:', error instanceof Error ? error.message : String(error));
    }
  }

  cleanup(): void {
    this.rl.close();
  }
}
