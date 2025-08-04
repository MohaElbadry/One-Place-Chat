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
    /**
     * If a tool has been selected but still requires parameters, we store the
     * partially-filled parameter object here so we can collect them over
     * subsequent user messages.
     */
    private pendingMatch: {
        tool: MCPTool;
        parameters: Record<string, any>;
        missing: string[];
    } | null = null;

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
            // If we are waiting for the user to supply missing parameters,
            // tweak the prompt so it feels like a conversational follow-up.
            const promptLabel = this.pendingMatch && this.pendingMatch.missing.length > 0
                ? `Provide value for "${this.pendingMatch.missing[0]}"`
                : 'You';

            const { message } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'message',
                    message: `${promptLabel}:`,
                    validate: (input: string) => input.trim() !== '' || 'Please enter a message'
                }
            ]);

            if (message.toLowerCase() === 'exit') {
                console.log(chalk.yellow('\n👋 Goodbye!'));
                process.exit(0);
            }

            // --------------------------------------------------------------
            // 1. Handle the case where we are still collecting parameters.
            // --------------------------------------------------------------
            if (this.pendingMatch) {
                await this.handlePendingParameters(message.trim());
                // Either we got all params (and handled execution) or we need
                // more. In either case, skip the rest of this loop iteration.
                continue;
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

                // ----------------------------------------------------------
                // 2. Check if the matched tool is missing required params.
                // ----------------------------------------------------------
                const requiredParams: string[] = toolMatch.tool.inputSchema?.required as string[] ?? [];
                const providedParams = Object.keys(toolMatch.parameters || {});
                const missingParams = requiredParams.filter(p => !providedParams.includes(p));

                if (missingParams.length > 0) {
                    console.log(chalk.yellow(`\n🛠  The selected API requires additional parameters: ${missingParams.join(', ')}`));
                    console.log(chalk.yellow(`👉 Please provide a value for "${missingParams[0]}" to continue.`));

                    this.pendingMatch = {
                        tool: toolMatch.tool,
                        parameters: { ...toolMatch.parameters },
                        missing: missingParams
                    };
                    // Go back to top of loop to ask for the first value
                    continue;
                }

                await this.generateAndOptionallyExecute(toolMatch.tool, toolMatch.parameters);

            } catch (error) {
                console.error(chalk.red('\n❌ Error:'), error);
            }
        }
    }

    /**
     * When we have a pending tool that still needs parameters, this method
     * attempts to parse the user input, update the parameter object, and either
     * ask for more or move on to generating the curl command.
     */
    private async handlePendingParameters(userInput: string) {
        if (!this.pendingMatch) return;

        const { tool, parameters, missing } = this.pendingMatch;

        // Attempt to parse input as JSON first (allows user to paste an object).
        let parsed: Record<string, any> = {};
        try {
            parsed = JSON.parse(userInput);
        } catch {
            // Not JSON – try key=value pairs
            const kvRegex = /(\w+)\s*=\s*([^,\s]+)/g;
            let match: RegExpExecArray | null;
            while ((match = kvRegex.exec(userInput)) !== null) {
                parsed[match[1]] = match[2];
            }

            // If we still have nothing, treat entire input as the next param value
            if (Object.keys(parsed).length === 0 && missing.length > 0) {
                parsed[missing[0]] = userInput;
            }
        }

        Object.assign(parameters, parsed);

        // Re-evaluate missing parameters
        const stillMissing = missing.filter(p => parameters[p] === undefined);

        if (stillMissing.length > 0) {
            // Update pendingMatch with remaining missing params and ask again.
            this.pendingMatch.missing = stillMissing;
            console.log(chalk.yellow(`\n🔄 Need value for "${stillMissing[0]}"`));
            return;
        }

        // All parameters gathered – generate curl and execute.
        await this.generateAndOptionallyExecute(tool, parameters);
        // Clear pending state.
        this.pendingMatch = null;
    }

    /** Helper to produce curl and optionally execute it. */
    private async generateAndOptionallyExecute(tool: MCPTool, params: Record<string, any>) {
        const curlCommand = this.toolMatcher.generateCurlCommand(tool, params);

        console.log(chalk.green('\n🔧 Generated cURL command:'));
        console.log(chalk.cyan(curlCommand));

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

                try {
                    const jsonResponse = JSON.parse(result);
                    console.log(JSON.stringify(jsonResponse, null, 2));
                } catch {
                    console.log(result);
                }

                console.log(chalk.gray('----------------\n'));
            } catch (error: any) {
                console.error(chalk.red('\n❌ Error executing request:'));
                console.error(chalk.red(error.message));
            }
        }
    }
}

// Start the chat interface
const chat = new ChatInterface();
chat.initialize().catch(console.error);
