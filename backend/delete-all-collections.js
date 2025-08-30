#!/usr/bin/env node

// delete-all-collections.js - Delete all collections from ChromaDB
import { ChromaClient } from 'chromadb';

async function deleteAllCollections() {
  let client;
  
  try {
    // Initialize ChromaDB client
    console.log('🔍 Connecting to ChromaDB server...');
    client = new ChromaClient({
      host: "localhost",
      port: 8000
    });
    
    // Test connection
    console.log('🏥 Testing connection...');
    const heartbeat = await client.heartbeat();
    console.log('✅ ChromaDB connection successful:', heartbeat);
    
    // // List all collections first
    // console.log('📋 Listing all collections...');
    const collections = await client.listCollections();
    console.log(`Found ${collections.length} collections:`, collections.map(c => c.name));
    
    if (collections.length === 0) {
      console.log('ℹ️ No collections found to delete');
      return;
    }
    
    // Confirm deletion
    console.log('\n⚠️  WARNING: This will delete ALL collections and ALL data!');
    console.log('📝 Collections to be deleted:');
    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}`);
    });
    // Delete each collection
    console.log('\n🗑️  Starting deletion process...');
    
    for (const collection of collections) {
      try {
        console.log(`🗑️  Deleting collection: ${collection.name}`);
        await client.deleteCollection({
          name: collection.name
        });
        console.log(`✅ Successfully deleted: ${collection.name}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${collection.name}:`, error.message);
      }
    }
    
    // Verify all collections are deleted
    console.log('\n🔍 Verifying deletion...');
    const remainingCollections = await client.listCollections();
    
    if (remainingCollections.length === 0) {
      console.log('✅ SUCCESS: All collections have been deleted!');
    } else {
      console.log(`⚠️  WARNING: ${remainingCollections.length} collections still remain:`);
      remainingCollections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.error('💡 Solution: ChromaDB server is not running.');
      console.error('   Try running: docker-compose up chromadb -d');
      console.error('   Or check if ChromaDB is running on http://localhost:8000');
    } else {
      console.error('💡 Full error details:', error);
    }
  }
}

// Enhanced error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n👋 Script interrupted by user');
  process.exit(0);
});

console.log('🚀 Starting ChromaDB collection deletion script...');
console.log('📍 Target: Delete ALL collections from ChromaDB');
console.log('🎯 ChromaDB Server: http://localhost:8000');
console.log('⚠️  WARNING: This will permanently delete all data!\n');

deleteAllCollections().finally(() => {
  console.log('\n🏁 Script execution completed');
  process.exit(0);
});
