#!/usr/bin/env node

/**
 * Script to clear all conversations from ChromaDB
 * This will help fix issues with old conversation data format
 */

import { ChromaClient } from 'chromadb';

async function clearConversations() {
  console.log('🧹 Clearing all conversations from ChromaDB...');
  
  try {
    const client = new ChromaClient({ 
      host: 'localhost',
      port: 8000 
    });

    // Delete the entire conversations collection
    try {
      await client.deleteCollection({ name: 'conversations' });
      console.log('✅ Deleted conversations collection');
    } catch (error) {
      if (error.message?.includes('not found')) {
        console.log('ℹ️ Conversations collection does not exist');
      } else {
        throw error;
      }
    }

    // Recreate the conversations collection fresh
    await client.createCollection({
      name: 'conversations',
      metadata: {
        description: 'Conversation history with context embeddings'
      }
    });
    
    console.log('✅ Created fresh conversations collection');
    console.log('🎉 All conversations cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing conversations:', error);
    process.exit(1);
  }
}

clearConversations();
