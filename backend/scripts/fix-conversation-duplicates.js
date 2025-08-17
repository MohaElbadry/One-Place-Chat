#!/usr/bin/env node

/**
 * Fix duplicate conversations in ChromaDB
 * This script removes duplicate conversations and keeps only the latest one
 */

import { ChromaClient } from 'chromadb';

async function fixConversationDuplicates() {
  console.log('🔧 Fixing duplicate conversations in ChromaDB...');
  
  try {
    const chromaClient = new ChromaClient({ 
      host: 'localhost',
      port: 8000 
    });
    
    // Test connection
    await chromaClient.heartbeat();
    console.log('✅ ChromaDB connection successful');
    
    // Get the conversations collection
    const conversationsCollection = await chromaClient.getCollection({
      name: 'conversations'
    });
    
    // Get all conversations
    const results = await conversationsCollection.get({
      include: ['metadatas', 'documents']
    });
    
    if (!results.ids || results.ids.length === 0) {
      console.log('ℹ️ No conversations found');
      return;
    }
    
    console.log(`📊 Found ${results.ids.length} conversation records`);
    
    // Group by conversationId to find duplicates
    const conversationGroups = new Map();
    
    results.ids.forEach((id, index) => {
      const metadata = results.metadatas[index];
      const document = results.documents[index];
      
      if (metadata && document) {
        const conversationId = metadata.conversationId;
        if (!conversationGroups.has(conversationId)) {
          conversationGroups.set(conversationId, []);
        }
        conversationGroups.get(conversationId).push({
          id: id,
          metadata: metadata,
          document: document,
          lastActivity: new Date(metadata.lastActivity || metadata.createdAt)
        });
      }
    });
    
    console.log(`📋 Found ${conversationGroups.size} unique conversations`);
    
    // Find and remove duplicates
    let duplicatesRemoved = 0;
    const idsToDelete = [];
    
    for (const [conversationId, records] of conversationGroups) {
      if (records.length > 1) {
        console.log(`🔄 Conversation ${conversationId} has ${records.length} duplicates`);
        
        // Sort by lastActivity, keep the most recent
        records.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
        
        // Mark older duplicates for deletion
        for (let i = 1; i < records.length; i++) {
          idsToDelete.push(records[i].id);
          duplicatesRemoved++;
        }
      }
    }
    
    if (idsToDelete.length > 0) {
      console.log(`🗑️ Removing ${duplicatesRemoved} duplicate records...`);
      await conversationsCollection.delete({
        ids: idsToDelete
      });
      console.log('✅ Duplicates removed successfully');
    } else {
      console.log('✅ No duplicates found');
    }
    
    // Get final count
    const finalCount = await conversationsCollection.count();
    console.log(`📊 Final conversation count: ${finalCount}`);
    
  } catch (error) {
    console.error('❌ Error fixing conversation duplicates:', error);
  }
}

// Run the fix
fixConversationDuplicates().then(() => {
  console.log('🎉 Conversation duplicate fix completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fix failed:', error);
  process.exit(1);
});
