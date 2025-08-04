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
                // Save conversation before returning to menu
                if (this.currentConversationId) {
                    await this.chatEngine.saveConversation(this.currentConversationId);
                }
                await this.showConversationMenu();
                return;
            }

            if (!this.currentConversationId) {
                console.log(chalk.red('❌ No active conversation. Please start a new one.'));
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

            } catch (error: any) {
                console.error(chalk.red('\n❌ Error:'), error.message);
            }
        }
    }

    private displayResponse(response: ChatResponse) {
        console.log(response.message);

        if (response.toolMatch) {
            const confidence = response.toolMatch.confidence;
            let confidenceColor = chalk.red;
            if (confidence > 0.7) confidenceColor = chalk.green;
            else if (confidence > 0.4) confidenceColor = chalk.yellow;

            console.log(chalk.gray(`\n🔧 Tool: ${response.toolMatch.tool.name}`));
            console.log(confidenceColor(`🎯 Confidence: ${Math.round(confidence * 100)}%`));
        }

        if (response.suggestions && response.suggestions.length > 0) {
            console.log(chalk.gray('\n💡 Suggestions:'));
            response.suggestions.forEach(suggestion => {
                console.log(chalk.gray(`   ${suggestion}`));
            });
        }

        console.log(''); // Empty line for spacing
    }

    private async handleClarification(response: ChatResponse) {
        if (!response.clarificationRequest) return;

        // The clarification message is already displayed in displayResponse
        // The user will respond in the next iteration of the chat loop
        // The conversational engine will handle the clarification response
    }
}

// Start the chat interface
const chat = new ChatInterface();
chat.initialize().catch(console.error);
