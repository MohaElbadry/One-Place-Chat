#!/usr/bin/env node
import 'dotenv/config';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ChromaDBToolLoader } from '../tools/ChromaDBToolLoader.js';
import { ConversationalEngine } from '../core/ConversationalEngine.js';
import { EnhancedChatResponse } from '../types/conversation.types.js';
import { getAvailableModels } from '../config/llm-config.js';
import { MCPTool } from '../types/api.types.js';

/**
 * Interactive CLI chat interface for the conversational engine.
 * Provides a user-friendly command-line interface for API interactions.
 */
class ChatInterface {
    private tools: MCPTool[] = [];
    private chatEngine: ConversationalEngine;
    private currentConversationId: string | null = null;
    private selectedModel: string = 'gpt-4';

    constructor() {
        this.chatEngine = new ConversationalEngine(this.selectedModel);
    }

    async initialize() {
        console.clear();
        console.log(chalk.blue('🚀 Starting One-Place-Chat...'));
        
        const loader = new ChromaDBToolLoader();
        this.tools = await loader.loadTools();
        this.chatEngine.updateTools(this.tools);
        
        // Initialize systems
        if (this.tools.length > 0) {
            await this.chatEngine.initializeToolMatcher();
        }
        await this.chatEngine.initializeConversationStore();
        
        console.log(chalk.green(`✅ Ready! ${this.tools.length} API tools available`));
        
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
        console.log(chalk.white(response.message));
        
        if (response.toolMatch) {
            const confidence = response.toolMatch.confidence;
            const confidenceColor = confidence > 0.8 ? chalk.green : confidence > 0.5 ? chalk.yellow : chalk.red;
            
            console.log(chalk.gray(`\n🔧 Tool Detected: ${chalk.cyan(response.toolMatch.tool.name)}`));
            console.log(chalk.gray(`📊 Confidence: ${confidenceColor(confidence.toFixed(2))}`));
            console.log(chalk.gray(`📝 Description: ${response.toolMatch.tool.description}`));
            console.log(chalk.gray(`🌐 Method: ${chalk.blue(response.toolMatch.tool.endpoint.method)} ${chalk.gray(response.toolMatch.tool.endpoint.path)}`));
            
            if (response.toolMatch.parameters && Object.keys(response.toolMatch.parameters).length > 0) {
                console.log(chalk.gray(`📋 Parameters:`));
                Object.entries(response.toolMatch.parameters).forEach(([key, value]) => {
                    console.log(chalk.gray(`   ${chalk.cyan(key)}: ${chalk.yellow(value)}`));
                });
            }
            
            if (response.needsClarification && response.clarificationRequest) {
                console.log(chalk.yellow(`\n❓ Missing Information:`));
                if (response.clarificationRequest.missingFields && response.clarificationRequest.missingFields.length > 0) {
                    const requiredFields = response.clarificationRequest.missingFields.filter(f => f.type === 'required');
                    const optionalFields = response.clarificationRequest.missingFields.filter(f => f.type === 'optional');
                    
                    if (requiredFields.length > 0) {
                        console.log(chalk.red(`   Required: ${requiredFields.map(f => f.name).join(', ')}`));
                    }
                    if (optionalFields.length > 0) {
                        console.log(chalk.blue(`   Optional: ${optionalFields.map(f => f.name).join(', ')}`));
                    }
                }
                console.log(chalk.gray(`\n💡 Please provide the missing information or say "execute" to proceed with current parameters.`));
            }
        }
        
        if (response.needsClarification) {
            console.log(chalk.blue(`\n💬 Waiting for your input...`));
        }
    }

    private async selectModel() {
        const availableModels = getAvailableModels();
        
        if (availableModels.length > 1) {
            const { model } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'model',
                    message: 'Select LLM model:',
                    choices: availableModels.map(model => ({ name: model, value: model }))
                }
            ]);
            
            // Only create new engine if model changed
            if (this.selectedModel !== model) {
                this.selectedModel = model;
                this.chatEngine = new ConversationalEngine(model);
                this.chatEngine.updateTools(this.tools);
                
                // Re-initialize conversation store for new model
                await this.chatEngine.initializeConversationStore();
                console.log(chalk.gray(`Switched to ${model}`));
            }
        }
    }

    private formatDate(date: Date): string {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'just now';
    }

    private async startChat() {
        console.log(chalk.blue('\n-> Chat started! Type your request or "exit" to quit.\n'));
        console.log(chalk.gray('💡 How it works:'));
        console.log(chalk.gray('   1. I\'ll detect what tool you need from your message'));
        console.log(chalk.gray('   2. Extract any parameters you provide'));
        console.log(chalk.gray('   3. Ask for missing required information'));
        console.log(chalk.gray('   4. Execute the API call and show results'));
        console.log(chalk.gray('   5. You can say "execute" to proceed with current parameters'));
        console.log(chalk.gray('   6. Say "cancel" to start over\n'));
        
        while (true) {
            try {
                const { message } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'message',
                        message: chalk.cyan('You:'),
                        validate: (input: string) => {
                            if (!input.trim()) return 'Please enter a message';
                            return true;
                        }
                    }
                ]);

                if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
                    console.log(chalk.yellow('\n👋 Goodbye!'));
                    process.exit(0);
                }

                if (!this.currentConversationId) {
                    this.currentConversationId = this.chatEngine.startConversation();
                }
                
                console.log(chalk.gray('\n🤖 Processing your request...'));
                const response = await this.chatEngine.processMessage(this.currentConversationId, message);
                
                console.log(chalk.gray('\n🤖 Assistant:'));
                this.displayResponse(response);

                // Save conversation periodically
                await this.chatEngine.saveConversation(this.currentConversationId);
                
            } catch (error) {
                console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
            }
        }
    }
}

// Start the CLI
const cli = new ChatInterface();
cli.initialize().catch(console.error); 