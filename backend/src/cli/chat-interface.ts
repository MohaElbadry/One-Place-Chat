import 'dotenv/config';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ToolLoader } from '../tools/loader.js';
import { APIToolMatcher } from '../tools/api-tool-matcher.js';
import { CurlExecutor } from '../tools/executor.js';
import { MCPTool } from '../types.js';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

class ChatInterface {
    private tools: MCPTool[] = [];
    private toolMatcher: APIToolMatcher;
    private executor: CurlExecutor;

    constructor() {
        this.toolMatcher = new APIToolMatcher();
        this.executor = new CurlExecutor();
    }

    async initialize() {
        console.clear();
        console.log(chalk.blue('🔍 Loading tools...'));
        const loader = new ToolLoader();
        this.tools = await loader.loadTools('./generated-tools');
        console.log(chalk.green(`✅ Loaded ${this.tools.length} tools`));
        console.log(chalk.blue('💬 Type your request or "exit" to quit\n'));
        this.startChat();
    }

    private async startChat() {
        while (true) {
            const { message } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'message',
                    message: 'You:',
                    validate: (input: string) => input.trim() !== '' || 'Please enter a message'
                }
            ]);

            if (message.toLowerCase() === 'exit') {
                console.log(chalk.yellow('\n👋 Goodbye!'));
                process.exit(0);
            }

            try {
                // Get the best matching tool using AI
                const toolMatch = await this.toolMatcher.findBestMatch(message, this.tools);
                
                if (!toolMatch) {
                    console.log(chalk.yellow('\n🤖 I couldn\'t find a suitable API for your request.'));
                    continue;
                }

                // Display match details with color coding based on confidence
                const confidence = toolMatch.confidence;
                let confidenceColor = chalk.red;
                if (confidence > 0.7) confidenceColor = chalk.green;
                else if (confidence > 0.4) confidenceColor = chalk.yellow;

                console.log(chalk.blue(`\n🤖 ${chalk.bold('Best Match:')} ${chalk.bold(toolMatch.tool.name)}`));
                console.log(chalk.gray(`📝 ${toolMatch.tool.description}`));
                console.log(chalk.gray(`🔗 ${chalk.bold('Endpoint:')} ${toolMatch.tool.endpoint.method.toUpperCase()} ${toolMatch.tool.endpoint.baseUrl}${toolMatch.tool.endpoint.path}`));
                console.log(confidenceColor(`🎯 Confidence: ${Math.round(confidence * 100)}%`));
                console.log(chalk.blue(`💡 ${toolMatch.reasoning}`));
                
                // Show alternative suggestions if confidence is not very high
                if (confidence < 0.8) {
                    console.log(chalk.gray('\n🔍 Did you mean one of these?'));
                    // Show top 3 alternative commands
                    const alternatives = await this.toolMatcher.findSimilarTools(message, 3);
                    alternatives.forEach((alt, index) => {
                        console.log(chalk.gray(`  ${index + 1}. ${alt.tool.name} (${Math.round(alt.score * 100)}%)`));
                    });
                }

                // Generate cURL command
                const curlCommand = this.toolMatcher.generateCurlCommand(
                    toolMatch.tool,
                    toolMatch.parameters
                );

                console.log(chalk.green('\n🔧 Generated cURL command:'));
                console.log(chalk.cyan(curlCommand));

                // Ask if user wants to execute
                const { execute } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'execute',
                        message: 'Do you want to execute this command?',
                        default: true
                    }
                ]);

                if (execute) {
                    console.log(chalk.blue('\n🚀 Executing API call...\n'));
                    try {
                        const result = await this.executor.executeCurl(curlCommand);
                        console.log(chalk.green('✅ API Response:'));
                        console.log(chalk.gray('--- RESPONSE ---'));
                        
                        // Try to pretty print JSON if the response is JSON
                        try {
                            const jsonResponse = JSON.parse(result);
                            console.log(JSON.stringify(jsonResponse, null, 2));
                        } catch {
                            // If not JSON, print as is
                            console.log(result);
                        }
                        
                        console.log(chalk.gray('----------------\n'));
                    } catch (error: any) {
                        console.error(chalk.red('\n❌ Error executing request:'));
                        console.error(chalk.red(error.message));
                    }
                }

            } catch (error) {
                console.error(chalk.red('\n❌ Error:'), error);
            }
        }
    }
}

// Start the chat interface
const chat = new ChatInterface();
chat.initialize().catch(console.error);
