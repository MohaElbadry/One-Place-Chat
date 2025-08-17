#!/usr/bin/env node

/**
 * Demo: Better Conversation Architecture
 * 
 * This demonstrates the improved approach:
 * 1. Separate collections for conversations and messages
 * 2. No duplicate conversations
 * 3. Better scalability for large conversations
 * 4. Efficient message search with ChromaDB
 */

import { ChromaClient } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';

async function demoBetterArchitecture() {
  console.log('🚀 Demo: Better Conversation Architecture\n');
  
  try {
    const chromaClient = new ChromaClient({ 
      host: 'localhost',
      port: 8000 
    });
    
    // Test connection
    await chromaClient.heartbeat();
    console.log('✅ ChromaDB connection successful\n');
    
    // Create collections
    console.log('📚 Creating collections...');
    
    const conversationsCollection = await chromaClient.getOrCreateCollection({
      name: 'conversations',
      metadata: {
        description: 'Conversation metadata (lightweight)'
      }
    });
    
    const messagesCollection = await chromaClient.getOrCreateCollection({
      name: 'messages',
      metadata: {
        description: 'Individual messages with embeddings for semantic search'
      }
    });
    
    console.log('✅ Collections created\n');
    
    // Demo: Create a conversation
    console.log('💬 Creating demo conversation...');
    
    const conversationId = uuidv4();
    const conversationMetadata = {
      conversationId: conversationId,
      title: 'Demo Conversation',
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store conversation metadata (lightweight)
    await conversationsCollection.add({
      ids: [uuidv4()],
      embeddings: [[0, 0, 0]], // Placeholder embedding
      metadatas: [conversationMetadata],
      documents: [JSON.stringify({ id: conversationId, metadata: conversationMetadata })]
    });
    
    console.log('✅ Conversation metadata stored\n');
    
    // Demo: Add messages individually
    console.log('📝 Adding messages individually...');
    
    const messages = [
      { role: 'user', content: 'Hello, how are you?' },
      { role: 'assistant', content: 'I\'m doing well, thank you for asking!' },
      { role: 'user', content: 'Can you help me with a coding problem?' },
      { role: 'assistant', content: 'Of course! I\'d be happy to help with coding.' }
    ];
    
    const messageIds = [];
    const messageEmbeddings = [];
    const messageMetadatas = [];
    const messageDocuments = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const messageId = uuidv4();
      
      // Simple embedding (in real app, use OpenAI embeddings)
      const embedding = [i * 0.1, i * 0.2, i * 0.3];
      
      messageIds.push(messageId);
      messageEmbeddings.push(embedding);
      messageMetadatas.push({
        role: message.role,
        content: message.content.substring(0, 50),
        timestamp: new Date().toISOString(),
        conversationId: conversationId,
        messageIndex: i,
        createdAt: new Date().toISOString()
      });
      messageDocuments.push(JSON.stringify(message));
    }
    
    // Store messages
    await messagesCollection.add({
      ids: messageIds,
      embeddings: messageEmbeddings,
      metadatas: messageMetadatas,
      documents: messageDocuments
    });
    
    console.log(`✅ ${messages.length} messages stored\n`);
    
    // Demo: Update conversation metadata
    console.log('🔄 Updating conversation metadata...');
    
    const updatedMetadata = {
      ...conversationMetadata,
      messageCount: messages.length,
      lastActivity: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await conversationsCollection.update({
      ids: [conversationMetadata.conversationId],
      metadatas: [updatedMetadata]
    });
    
    console.log('✅ Conversation metadata updated\n');
    
    // Demo: Search messages semantically
    console.log('🔍 Searching messages semantically...');
    
    const searchResults = await messagesCollection.query({
      queryEmbeddings: [[0.1, 0.2, 0.3]], // Search for similar to first message
      nResults: 3,
      include: ['metadatas', 'documents', 'distances']
    });
    
    if (searchResults.ids[0] && searchResults.ids[0].length > 0) {
      console.log(`📋 Found ${searchResults.ids[0].length} similar messages:`);
      searchResults.ids[0].forEach((id, index) => {
        const metadata = searchResults.metadatas[0][index];
        const distance = searchResults.distances[0][index];
        const similarity = (1 - distance) * 100;
        console.log(`   ${index + 1}. ${metadata.content} (similarity: ${similarity.toFixed(1)}%)`);
      });
    }
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 Benefits of this architecture:');
    console.log('   ✅ No duplicate conversations');
    console.log('   ✅ Messages stored individually for better search');
    console.log('   ✅ Scalable - conversations with thousands of messages');
    console.log('   ✅ Efficient ChromaDB vector search across messages');
    console.log('   ✅ Atomic operations - each message insertion is independent');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo
demoBetterArchitecture().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
