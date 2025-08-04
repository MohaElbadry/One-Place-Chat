import 'dotenv/config';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ToolLoader } from '../tools/loader.js';
import { ConversationalChatEngine, ChatResponse } from '../utils/ConversationalChatEngine.js';
import { MCPTool } from '../types.js';

class ChatInterface {
    private tools: MCPTool[] = [];
    private chatEngine: ConversationalChatEngine;
    private currentConversationId: string | null = null;

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
        this.chatEngine = new ConversationalChatEngine();
    }

    async initialize() {
        console.clear();
        console.log(chalk.blue('🔍 Loading tools...'));
        const loader = new ToolLoader();
        this.tools = await loader.loadTools('./generated-tools');
        this.chatEngine.updateTools(this.tools);
        console.log(chalk.green(`✅ Loaded ${this.tools.length} tools`));
        
        // Show conversation options
        await this.showConversationMenu();
    }

    private async showConversationMenu() {
        const conversations = await this.chatEngine.listConversations();
        
        if (conversations.length === 0) {
            console.log(chalk.blue('💬 Starting a new conversation...\n'));
            this.currentConversationId = this.chatEngine.startConversation();
            this.startChat();
            return;
        }

        const choices = [
            { name: '🆕 Start a new conversation', value: 'new' },
            ...conversations.slice(0, 5).map((conv, index) => ({
                name: `📝 Resume conversation ${index + 1} (${conv.messageCount} messages, ${this.formatDate(conv.lastActivity)})`,
                value: conv.id
            })),
            { name: '📋 Show all conversations', value: 'show-all' }
        ];

        const { choice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'choice',
                message: 'What would you like to do?',
                choices
            }
        ]);

        if (choice === 'new') {
            this.currentConversationId = this.chatEngine.startConversation();
        } else if (choice === 'show-all') {
            await this.showAllConversations();
            return;
        } else {
            this.currentConversationId = choice;
            await this.chatEngine.loadConversation(choice);
            console.log(chalk.green(`✅ Resumed conversation ${choice}`));
        }

        this.startChat();
    }

    private async showAllConversations() {
        const conversations = await this.chatEngine.listConversations();
        
        console.log(chalk.blue('\n📋 All Conversations:'));
        conversations.forEach((conv, index) => {
            console.log(chalk.gray(`${index + 1}. ${conv.id.substring(0, 8)} - ${conv.messageCount} messages (${this.formatDate(conv.lastActivity)})`));
        });

        const { choice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'choice',
                message: 'Select a conversation or start new:',
                choices: [
                    { name: '🆕 Start new conversation', value: 'new' },
                    ...conversations.map(conv => ({
                        name: `${conv.id.substring(0, 8)} - ${conv.messageCount} messages`,
                        value: conv.id
                    }))
                ]
            }
        ]);

        if (choice === 'new') {
            this.currentConversationId = this.chatEngine.startConversation();
        } else {
            this.currentConversationId = choice;
            await this.chatEngine.loadConversation(choice);
        }

        this.startChat();
    }

    private formatDate(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    private async startChat() {
        console.log(chalk.blue('💬 Type your request, "menu" to return to menu, or "exit" to quit\n'));
        
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
                // Save conversation before exiting
                if (this.currentConversationId) {
                    await this.chatEngine.saveConversation(this.currentConversationId);
                }
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
                // Process message through conversational engine
                const response: ChatResponse = await this.chatEngine.processMessage(this.currentConversationId, message);
                
                // Display assistant's response
                console.log(chalk.blue('\n🤖 Assistant:'));
                this.displayResponse(response);

                // Handle clarification if needed
                if (response.needsClarification && response.clarificationRequest) {
                    await this.handleClarification(response);
                }

                // Save conversation periodically
                await this.chatEngine.saveConversation(this.currentConversationId);

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
