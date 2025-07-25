#!/usr/bin/env node
import { Command } from 'commander';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { MCPTool } from '../types.js';

dotenv.config();

interface ToolHelpOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  output?: string;
}

class ToolHelperCLI {
  private openai: OpenAI;
  private tools: MCPTool[] = [];
  
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async loadTools(toolsDir: string): Promise<void> {
    try {
      const files = fs.readdirSync(toolsDir).filter(file => file.endsWith('.json'));
      for (const file of files) {
        const toolData = JSON.parse(fs.readFileSync(path.join(toolsDir, file), 'utf-8'));
        this.tools.push(toolData);
      }
      console.log(`✅ Loaded ${this.tools.length} tools from ${toolsDir}`);
    } catch (error) {
      console.error('❌ Error loading tools:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  async generateCurlCommand(toolName: string, question: string, options: ToolHelpOptions): Promise<void> {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      console.error(`❌ Tool '${toolName}' not found`);
      process.exit(1);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4',
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 1000,
        messages: [
          {
            role: 'system',
            content: `You are an API expert that helps users generate proper cURL commands. 
            The user will ask a question about how to use an API endpoint, and you need to:
            1. Understand the API endpoint's purpose and parameters
            2. Generate a proper cURL command with all required headers and parameters
            3. Format the output in a clear, readable way with explanations
            
            The API endpoint details are:
            - Method: ${tool.annotations.method}
            - Path: ${tool.annotations.path}
            - Description: ${tool.description}
            - Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}
            
            Always include proper headers like Content-Type and Authorization if needed.`
          },
          {
            role: 'user',
            content: question
          }
        ]
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      if (options.output) {
        fs.writeFileSync(options.output, result);
        console.log(`✅ Output written to ${options.output}`);
      } else {
        console.log('\n📝 Generated cURL command:');
        console.log('='.repeat(80));
        console.log(result);
        console.log('='.repeat(80));
      }
    } catch (error) {
      console.error('❌ Error generating cURL command:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  listTools(): void {
    console.log('\n🛠️  Available Tools:');
    console.log('='.repeat(80));
    this.tools.forEach(tool => {
      console.log(`🔧 ${tool.name}`);
      console.log(`   ${tool.description}`);
      console.log(`   Method: ${tool.annotations.method} ${tool.annotations.path}`);
      console.log('   Parameters:');
      if (tool.inputSchema.properties) {
        Object.entries(tool.inputSchema.properties).forEach(([name, prop]) => {
          if (prop && typeof prop === 'object' && !Array.isArray(prop)) {
            const propSchema = prop as { description?: string };
            const required = tool.inputSchema.required?.includes(name) ? ' (required)' : '';
            console.log(`   - ${name}: ${propSchema.description || 'No description'}${required}`);
          } else {
            console.log(`   - ${name}: No description available`);
          }
        });
      }
      console.log('-'.repeat(80));
    });
  }
}

async function main() {
  const program = new Command();
  
  program
    .name('tool-helper')
    .description('CLI to generate cURL commands for API tools using OpenAI')
    .version('1.0.0')
    .requiredOption('-t, --tools-dir <path>', 'Path to directory containing tool definitions')
    .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4')
    .option('--temperature <number>', 'Temperature for generation', '0.3')
    .option('--max-tokens <number>', 'Maximum number of tokens to generate', '1000');

  program
    .command('generate <tool-name> <question>')
    .description('Generate a cURL command for a specific tool')
    .option('-o, --output <file>', 'Output file to save the result')
    .action(async (toolName, question, cmdObj) => {
      const options = {
        ...program.opts(),
        ...cmdObj.opts(),
        temperature: parseFloat(program.opts().temperature),
        maxTokens: parseInt(program.opts().maxTokens, 10)
      };
      
      const helper = new ToolHelperCLI();
      await helper.loadTools(program.opts().toolsDir);
      await helper.generateCurlCommand(toolName, question, options);
    });

  program
    .command('list')
    .description('List all available tools')
    .action(async () => {
      const helper = new ToolHelperCLI();
      await helper.loadTools(program.opts().toolsDir);
      helper.listTools();
    });

  program.parse(process.argv);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
