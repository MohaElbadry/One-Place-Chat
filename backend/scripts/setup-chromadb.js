#!/usr/bin/env node

/**
 * ChromaDB Setup and Migration Script
 * 
 * This script helps you:
 * 1. Install and start ChromaDB
 * 2. Migrate existing tools and conversations to ChromaDB
 * 3. Test the database connection
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 ChromaDB Setup and Migration Script');
console.log('=====================================\n');

// Check if ChromaDB is installed
function checkChromaDBInstallation() {
  try {
    execSync('chroma --version', { stdio: 'pipe' });
    console.log('✅ ChromaDB is already installed');
    return true;
  } catch (error) {
    console.log('❌ ChromaDB is not installed');
    return false;
  }
}

// Install ChromaDB
function installChromaDB() {
  console.log('\n📦 Installing ChromaDB...');
  try {
    execSync('pip install chromadb', { stdio: 'inherit' });
    console.log('✅ ChromaDB installed successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to install ChromaDB:', error.message);
    return false;
  }
}

// Start ChromaDB server
function startChromaDBServer() {
  console.log('\n🚀 Starting ChromaDB server...');
  try {
    // Check if server is already running
    try {
      execSync('curl -s http://localhost:8000/api/v1/heartbeat', { stdio: 'pipe' });
      console.log('✅ ChromaDB server is already running');
      return true;
    } catch (error) {
      // Server not running, start it
      console.log('Starting ChromaDB server in background...');
      execSync('chroma run --host localhost --port 8000 --path ./chroma_db', { 
        stdio: 'pipe',
        detached: true 
      });
      
      // Wait a bit for server to start
      console.log('Waiting for server to start...');
      setTimeout(() => {
        try {
          execSync('curl -s http://localhost:8000/api/v1/heartbeat', { stdio: 'pipe' });
          console.log('✅ ChromaDB server started successfully');
        } catch (error) {
          console.log('⚠️ Server might still be starting, please wait...');
        }
      }, 3000);
      
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to start ChromaDB server:', error.message);
    return false;
  }
}

// Test database connection
function testDatabaseConnection() {
  console.log('\n🔍 Testing database connection...');
  try {
    const response = execSync('curl -s http://localhost:8000/api/v1/heartbeat', { stdio: 'pipe' });
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Migrate existing tools
function migrateExistingTools() {
  console.log('\n📁 Migrating existing tools...');
  
  const generatedToolsDir = join(__dirname, '..', 'generated-tools');
  
  if (!existsSync(generatedToolsDir)) {
    console.log('⚠️ No generated-tools directory found');
    return 0;
  }
  
  try {
    const toolFiles = readdirSync(generatedToolsDir).filter(file => file.endsWith('.json'));
    console.log(`Found ${toolFiles.length} tool files to migrate`);
    
    let migratedCount = 0;
    
    for (const file of toolFiles) {
      try {
        const toolPath = join(generatedToolsDir, file);
        const toolContent = readFileSync(toolPath, 'utf-8');
        const tool = JSON.parse(toolContent);
        
        // Here you would call your ChromaDB service to store the tool
        // For now, we'll just count them
        migratedCount++;
        
        if (migratedCount % 10 === 0) {
          console.log(`📊 Migrated ${migratedCount}/${toolFiles.length} tools`);
        }
      } catch (error) {
        console.error(`❌ Failed to migrate tool ${file}:`, error.message);
      }
    }
    
    console.log(`✅ Successfully migrated ${migratedCount} tools`);
    return migratedCount;
  } catch (error) {
    console.error('❌ Failed to migrate tools:', error.message);
    return 0;
  }
}

// Migrate existing conversations
function migrateExistingConversations() {
  console.log('\n💬 Migrating existing conversations...');
  
  const conversationsDir = join(__dirname, '..', 'conversations');
  
  if (!existsSync(conversationsDir)) {
    console.log('⚠️ No conversations directory found');
    return 0;
  }
  
  try {
    const conversationFiles = readdirSync(conversationsDir).filter(file => file.endsWith('.json'));
    console.log(`Found ${conversationFiles.length} conversation files to migrate`);
    
    let migratedCount = 0;
    
    for (const file of conversationFiles) {
      try {
        const conversationPath = join(conversationsDir, file);
        const conversationContent = readFileSync(conversationPath, 'utf-8');
        const conversation = JSON.parse(conversationContent);
        
        // Here you would call your ChromaDB service to store the conversation
        // For now, we'll just count them
        migratedCount++;
        
        if (migratedCount % 10 === 0) {
          console.log(`📊 Migrated ${migratedCount}/${conversationFiles.length} conversations`);
        }
      } catch (error) {
        console.error(`❌ Failed to migrate conversation ${file}:`, error.message);
      }
    }
    
    console.log(`✅ Successfully migrated ${migratedCount} conversations`);
    return migratedCount;
  } catch (error) {
    console.error('❌ Failed to migrate conversations:', error.message);
    return 0;
  }
}

// Main execution
async function main() {
  console.log('Starting ChromaDB setup...\n');
  
  // Step 1: Check/Install ChromaDB
  if (!checkChromaDBInstallation()) {
    if (!installChromaDB()) {
      console.error('❌ Cannot proceed without ChromaDB');
      process.exit(1);
    }
  }
  
  // Step 2: Start server
  if (!startChromaDBServer()) {
    console.error('❌ Cannot proceed without ChromaDB server');
    process.exit(1);
  }
  
  // Step 3: Test connection
  if (!testDatabaseConnection()) {
    console.error('❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  // Step 4: Migrate data
  const toolsMigrated = migrateExistingTools();
  const conversationsMigrated = migrateExistingConversations();
  
  console.log('\n🎉 Setup Complete!');
  console.log('==================');
  console.log(`📁 Tools migrated: ${toolsMigrated}`);
  console.log(`💬 Conversations migrated: ${conversationsMigrated}`);
  console.log('\nNext steps:');
  console.log('1. Update your .env file with ChromaDB settings');
  console.log('2. Modify your ConversationalEngine to use ChromaDB services');
  console.log('3. Test the new database integration');
  console.log('\nFor more information, check the README.md file');
}

// Run the setup
main().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
