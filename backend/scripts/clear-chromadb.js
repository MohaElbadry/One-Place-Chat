#!/usr/bin/env node

/**
 * Clear ChromaDB Collections Script
 * 
 * This script clears all collections in ChromaDB to remove duplicate data
 */

import { ChromaClient } from 'chromadb';

async function clearChromaDB() {
  console.log('🧹 Clearing ChromaDB Collections...');
  
  try {
    const client = new ChromaClient({ 
      host: 'localhost',
      port: 8000 
    });

    // Check if server is running
    try {
      await client.heartbeat();
      console.log('✅ ChromaDB server is running');
    } catch (error) {
      console.error('❌ ChromaDB server is not running. Please start it first.');
      return;
    }

    // List all collections
    const collections = await client.listCollections();
    console.log(`Found ${collections.length} collections:`, collections.map(c => c.name));

    // Delete each collection
    for (const collection of collections) {
      console.log(`🗑️ Deleting collection: ${collection.name}`);
      await client.deleteCollection({ name: collection.name });
    }

    console.log('✅ All collections cleared successfully');
    console.log('💡 You can now restart the backend server to recreate collections without duplicates');

  } catch (error) {
    console.error('❌ Error clearing ChromaDB:', error);
  }
}

clearChromaDB();
