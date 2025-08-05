import 'dotenv/config';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ToolLoader } from '../tools/loader.js';
import { EnhancedConversationalEngine, EnhancedChatResponse } from '../utils/EnhancedConversationalEngine.js';
import { getAvailableModels } from '../config/llm-config.js';
import { MCPTool } from '../types.js';

class EnhancedChatInterface {
    private tools: MCPTool[] = [];
    private chatEngine: EnhancedConversationalEngine;
    private currentConversationId: string | null = null;
    private selectedModel: string = 'gpt-4';

    constructor() {
        this.chatEngine = new EnhancedConversationalEngine(this.selectedModel);
    }

    async initialize() {
        console.clear();
        console.log(chalk.blue('🔍 Loading tools...'));
        const loader = new ToolLoader();
        this.tools = await loader.loadTools('./generated-tools');
        this.chatEngine.updateTools(this.tools);
        console.log(chalk.green(`✅ Loaded ${this.tools.length} tools`));
        
        // Select model
        await this.selectModel();
        
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

    private displayResponse(response: EnhancedChatResponse) {
        if (response.message) {
            console.log(chalk.white(response.message));
        }
        
        // Handle any additional data in the response
        if (response.executionResult) {
            console.log(chalk.gray('--- EXECUTION RESULT ---'));
            try {
                const jsonData = typeof response.executionResult === 'string' ? JSON.parse(response.executionResult) : response.executionResult;
                console.log(JSON.stringify(jsonData, null, 2));
            } catch (e) {
                console.log(response.executionResult);
            }
        }
    }

    private async selectModel() {
        const availableModels = getAvailableModels();
        
        const { model } = await inquirer.prompt([
            {
                type: 'list',
                name: 'model',
                message: 'Select an LLM model:',
                choices: availableModels.map(model => ({
                    name: model,
                    value: model
                }))
            }
        ]);

        this.selectedModel = model;
        this.chatEngine = new EnhancedConversationalEngine(this.selectedModel);
        this.chatEngine.updateTools(this.tools);
        console.log(chalk.green(`✅ Using model: ${model}`));
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
            const { message } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'message',
                    message: 'You:',
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

            if (message.toLowerCase() === 'menu') {
                await this.showConversationMenu();
                return;
            }

            try {
                // Ensure we have a valid conversation ID
                if (!this.currentConversationId) {
                    this.currentConversationId = this.chatEngine.startConversation();
                }
                
                // Process message through enhanced conversational engine
                const response: EnhancedChatResponse = await this.chatEngine.processMessage(this.currentConversationId, message);
                
                // Display assistant's response
                console.log(chalk.blue('\n🤖 Assistant:'));
                this.displayResponse(response);

                // Save conversation periodically
                await this.chatEngine.saveConversation(this.currentConversationId);

            } catch (error) {
                console.error(chalk.red('\n❌ Error:'), error);
            }
        }
    }
}

// Start the enhanced chat interface
const chat = new EnhancedChatInterface();
chat.initialize().catch(console.error); 