import 'dotenv/config';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ToolLoader } from '../tools/loader.js';
import { EnhancedConversationalChatEngine as ConversationalChatEngine, ChatResponse } from '../utils/ConversationalChatEngine.js';
import { MCPTool } from '../types.js';
import { ToolMatcher } from '../utils/ToolMatcher.js';
import { CommandExecutor } from '../utils/CommandExecutor.js';

class ChatInterface {
    private tools: MCPTool[] = [];
    private chatEngine: ConversationalChatEngine;
    private toolMatcher: ToolMatcher;
    private executor: CommandExecutor;
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
        this.toolMatcher = new ToolMatcher();
        this.executor = new CommandExecutor();
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

    private getConfidenceColor(confidence: number) {
        if (confidence > 0.8) return chalk.green;
        if (confidence > 0.5) return chalk.yellow;
        return chalk.red;
    }

    private displayResponse(response: ChatResponse) {
        if (response.message) {
            console.log(chalk.white(response.message));
        }
        
        // Handle any additional data in the response
        if ((response as any).data) {
            console.log(chalk.gray('--- DATA ---'));
            try {
                const data = (response as any).data;
                const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
                console.log(JSON.stringify(jsonData, null, 2));
            } catch (e) {
                console.log((response as any).data);
            }
        }
    }

    private async handleClarification(response: ChatResponse) {
        if (!response.clarificationRequest) return;
        
        console.log(chalk.yellow('\n❓ ' + response.clarificationRequest.message));
        
        // If there are specific fields we need, show them
        if (response.clarificationRequest.fields?.length) {
            console.log(chalk.yellow('\nPlease provide the following information:'));
            response.clarificationRequest.fields.forEach((field, index) => {
                console.log(chalk.yellow(`${index + 1}. ${field.name}: ${field.description}`));
                if (field.possibleValues?.length) {
                    console.log(chalk.yellow(`   Possible values: ${field.possibleValues.join(', ')}`));
                }
            });
        }
        
        const { answer } = await inquirer.prompt([
            {
                type: 'input',
                name: 'answer',
                message: 'Your response:',
                validate: (input: string) => input.trim() !== '' || 'Please provide a response'
            }
        ]);
        
        // Process the clarification response
        if (this.currentConversationId) {
            const clarificationResponse = await this.chatEngine.processMessage(this.currentConversationId, answer);
            this.displayResponse(clarificationResponse);
        }
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
                // Ensure we have a valid conversation ID
                if (!this.currentConversationId) {
                    this.currentConversationId = this.chatEngine.startConversation();
                }
                
                // Process message through conversational engine
                const response: ChatResponse = await this.chatEngine.processMessage(this.currentConversationId, message);
                
                // Display assistant's response
                console.log(chalk.blue('\n🤖 Assistant:'));
                this.displayResponse(response);

                // Handle clarification if needed
                if (response.needsClarification && response.clarificationRequest) {
                    await this.handleClarification(response);
                    continue;
                }

                // Save conversation periodically
                await this.chatEngine.saveConversation(this.currentConversationId);

                // Find the best matching tool
                const result = await this.toolMatcher.findBestMatch(message, this.tools);
                
                if (!result || !result.toolMatch) {
                    console.log(chalk.yellow('\n❌ No matching tool found for your request.'));
                    continue;
                }
                
                const { toolMatch, confidence } = result;

                console.log(chalk.blue(`\n🤖 ${chalk.bold('Best Match:')} ${chalk.bold(toolMatch.tool.name)}`));
                console.log(chalk.gray(`📝 ${toolMatch.tool.description}`));
                
                if (toolMatch.tool.endpoint) {
                    console.log(chalk.gray(`🔗 ${chalk.bold('Endpoint:')} ${toolMatch.tool.endpoint.method.toUpperCase()} ${toolMatch.tool.endpoint.baseUrl}${toolMatch.tool.endpoint.path}`));
                }
                
                const confidenceColor = this.getConfidenceColor(confidence);
                console.log(confidenceColor(`🎯 Confidence: ${Math.round(confidence * 100)}%`));
                
                if (toolMatch.reasoning) {
                    console.log(chalk.blue(`💡 ${toolMatch.reasoning}`));
                }
                
                // Show alternative suggestions if confidence is not very high
                if (confidence < 0.8) {
                    console.log(chalk.gray('\n🔍 Did you mean one of these?'));
                    // Show top 3 alternative commands
                    const alternatives = await this.toolMatcher.findSimilarTools(message, 3);
                    if (alternatives.length > 0) {
                        alternatives.forEach((alt, index) => {
                            console.log(chalk.gray(`  ${index + 1}. ${alt.tool.name} (${Math.round(alt.score * 100)}%)`));
                        });
                    } else {
                        console.log(chalk.gray('  No similar tools found.'));
                    }
                }

                // ----------------------------------------------------------
                // 2. Check if the matched tool is missing required params.
                // ----------------------------------------------------------
                const requiredParams: string[] = toolMatch.tool.inputSchema?.required as string[] ?? [];
                const providedParams = Object.keys(toolMatch.parameters || {});
                const missingParams = requiredParams.filter(p => !providedParams.includes(p));

                if (missingParams.length > 0) {
                    const firstMissing = missingParams[0];
                    const fieldSchema = toolMatch.tool.inputSchema?.properties?.[firstMissing];
                    const schema = typeof fieldSchema === 'object' && fieldSchema !== null ? fieldSchema : {};
                    
                    let prompt = `\n🛠  ${toolMatch.tool.name} requires ${missingParams.length} more parameter${missingParams.length > 1 ? 's' : ''}.`;
                    prompt += `\n👉 Let's start with: ${chalk.bold(firstMissing)}`;
                    
                    if ('description' in schema && schema.description) {
                        prompt += `\n   ${schema.description}`;
                    }
                    if ('enum' in schema && Array.isArray(schema.enum)) {
                        prompt += `\n   Possible values: ${schema.enum.join(', ')}`;
                    }
                    if ('type' in schema && schema.type === 'boolean') {
                        prompt += '\n   Please answer yes/no';
                    }
                    
                    console.log(chalk.yellow(prompt));

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
        const currentField = missing[0];
        const fieldSchema = tool.inputSchema?.properties?.[currentField];
        const schema = typeof fieldSchema === 'object' && fieldSchema !== null ? fieldSchema : {};
        
        // Extract the value from natural language input
        let extractedValue: any = userInput.trim();
        
        // Try to parse specific types based on schema
        if ('type' in schema) {
            if (schema.type === 'integer' || schema.type === 'number') {
                // Extract first number from input
                const numMatch = userInput.match(/\d+/);
                if (numMatch) {
                    extractedValue = schema.type === 'integer' 
                        ? parseInt(numMatch[0], 10) 
                        : parseFloat(numMatch[0]);
                }
            } else if (schema.type === 'boolean') {
                // Match yes/no, true/false
                if (/\b(yes|true|y)\b/i.test(userInput)) {
                    extractedValue = true;
                } else if (/\b(no|false|n)\b/i.test(userInput)) {
                    extractedValue = false;
                }
            }
        }
        
        // Handle enum values separately
        if ('enum' in schema && Array.isArray(schema.enum)) {
            const lowerInput = userInput.toLowerCase();
            const matchedValue = schema.enum.find((e: any) => 
                e.toString().toLowerCase() === lowerInput
            );
            if (matchedValue) {
                extractedValue = matchedValue;
            }
        }

        // Store the extracted value
        parameters[currentField] = extractedValue;

        // Re-evaluate missing parameters
        const stillMissing = missing.slice(1);

        if (stillMissing.length > 0) {
            // Update pendingMatch with remaining missing params
            this.pendingMatch.missing = stillMissing;
            const nextField = stillMissing[0];
            const nextFieldSchema = tool.inputSchema?.properties?.[nextField];
            const schema = typeof nextFieldSchema === 'object' && nextFieldSchema !== null ? nextFieldSchema : {};
            
            // Show a helpful prompt for the next field
            let prompt = `\n🔄 Please provide ${nextField}`;
            
            if ('description' in schema && schema.description) {
                prompt += ` (${schema.description})`;
            }
            if ('enum' in schema && Array.isArray(schema.enum)) {
                prompt += `\n   Possible values: ${schema.enum.join(', ')}`;
            }
            if ('type' in schema && schema.type === 'boolean') {
                prompt += '\n   Please answer yes/no';
            }
            console.log(chalk.yellow(prompt));
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
                } catch (e) {
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
