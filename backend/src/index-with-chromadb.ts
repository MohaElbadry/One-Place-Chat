#!/usr/bin/env node

/**
 * Enhanced Index with ChromaDB Integration
 * 
 * This file extends the original index.ts to:
 * 1. Generate tools from OpenAPI specs
 * 2. Generate embeddings for all tools
 * 3. Store tools and embeddings in ChromaDB
 * 4. Provide semantic search capabilities
 */

import { Command } from 'commander';
import { OpenApiToolParser } from './parsers/OpenApiToolParser.js';
import { ChromaClient } from 'chromadb';
import OpenAI from 'openai';
import { readFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

interface ToolWithEmbedding {
  id: string;
  tool: any;
  embedding: number[];
  metadata: {
    name: string;
    description: string;
    method: string;
    path: string;
    tags: string[];
    createdAt: string;
  };
}

async function generateEmbedding(text: string, openai: OpenAI): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

async function generateToolsWithChromaDB(
  specPath: string, 
  outputDir: string, // Unused parameter, kept for compatibility
  singleFile: boolean, // Unused parameter, kept for compatibility
  storeInChromaDB: boolean = true
): Promise<void> {
  console.log('🚀 Generating tools with ChromaDB integration...');
  
  // Check if OpenAI API key is available
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log('⚠️ OPENAI_API_KEY not set, skipping embedding generation');
    storeInChromaDB = false;
  }

  let openai: OpenAI | null = null;
  let chromaClient: ChromaClient | null = null;
  
  if (storeInChromaDB) {
    try {
      openai = new OpenAI({ apiKey: openaiKey });
      chromaClient = new ChromaClient({ path: 'http://localhost:8000' });
      
      // Test ChromaDB connection
      await chromaClient.heartbeat();
      console.log('✅ ChromaDB connection successful');
    } catch (error) {
      console.error('❌ ChromaDB connection failed:', error);
      console.log('⚠️ Continuing without ChromaDB integration');
      storeInChromaDB = false;
    }
  }

  try {
    // Read OpenAPI specification
    if (!existsSync(specPath)) {
      throw new Error(`OpenAPI specification file not found: ${specPath}`);
    }

    const specContent = readFileSync(specPath, 'utf-8');
    const spec = JSON.parse(specContent);
    
    console.log(`📖 Parsing OpenAPI specification: ${spec.info?.title || 'Unknown API'}`);

    // Parse tools
    const parser = new OpenApiToolParser(spec);
    const tools = parser.parseOperations();
    
    console.log(`🔧 Generated ${tools.length} tools`);

    // No need to create output directory - everything goes to ChromaDB

    let toolIds: string[] = [];
    let toolEmbeddings: number[][] = [];
    let toolMetadatas: any[] = [];
    let toolDocuments: string[] = [];

    if (storeInChromaDB && chromaClient) {
      console.log('🧠 Generating embeddings and storing in ChromaDB...');
      
      // Create or get ChromaDB collection
      const toolsCollection = await chromaClient.getOrCreateCollection({
        name: 'generated_tools',
        metadata: { 
          description: `Tools generated from ${spec.info?.title || 'OpenAPI spec'}`,
          source: specPath,
          generatedAt: new Date().toISOString()
        }
      });

      // Generate embeddings for each tool
      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        
        // Create text representation for embedding
        const toolText = [
          tool.name || 'unnamed',
          tool.description || '',
          tool.annotations?.method || '',
          tool.annotations?.path || '',
          (tool.annotations?.tags || []).join(' ')
        ].filter(Boolean).join(' ');
        
        console.log(`   Generating embedding for: ${tool.name || `tool_${i + 1}`}`);
        
        try {
          const embedding = await generateEmbedding(toolText, openai!);
          
          const toolId = `tool_${Date.now()}_${i}`;
          toolIds.push(toolId);
          toolEmbeddings.push(embedding);
          toolMetadatas.push({
            name: tool.name || `tool_${i + 1}`,
            description: tool.description || 'No description',
            method: tool.annotations?.method || 'UNKNOWN',
            path: tool.annotations?.path || 'No path',
            tags: (tool.annotations?.tags || []).join(','), // Convert array to comma-separated string
            createdAt: new Date().toISOString(),
            source: specPath
          });
          toolDocuments.push(JSON.stringify(tool));
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if ((i + 1) % 10 === 0) {
            console.log(`   📊 Processed ${i + 1}/${tools.length} tools`);
          }
        } catch (error) {
          console.error(`   ❌ Failed to generate embedding for tool ${i + 1}:`, error);
        }
      }

      // Store in ChromaDB
      if (toolIds.length > 0) {
        console.log(`📦 Storing ${toolIds.length} tools in ChromaDB...`);
        await toolsCollection.add({
          ids: toolIds,
          embeddings: toolEmbeddings,
          metadatas: toolMetadatas,
          documents: toolDocuments
        });
        console.log('✅ Tools stored in ChromaDB successfully');
        
        // Get collection stats
        const stats = await toolsCollection.count();
        console.log(`📊 Total tools in ChromaDB: ${stats}`);
      }
    }

    // Store tools in ChromaDB (no file output needed)
    console.log('💾 All tools stored in ChromaDB - no files needed!');

    console.log('\n🎉 Tool generation completed!');
    
    if (storeInChromaDB && toolIds.length > 0) {
      console.log('\nChromaDB Storage Summary:');
      console.log(`- Generated ${toolIds.length} tool embeddings`);
      console.log(`- Stored in collection: generated_tools`);
      console.log(`- Source: ${specPath}`);
      console.log(`- No files created - everything stored in ChromaDB`);
      console.log('\nYou can now perform semantic search on your tools!');
    }

  } catch (error) {
    console.error('❌ Tool generation failed:', error);
    process.exit(1);
  }
}

async function searchTools(query: string, limit: number = 5): Promise<void> {
  console.log(`🔍 Searching for tools: "${query}"`);
  
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log('❌ OPENAI_API_KEY not set, cannot perform semantic search');
    return;
  }

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const chromaClient = new ChromaClient({ path: 'http://localhost:8000' });
    
    // Test connection
    await chromaClient.heartbeat();
    
    // Get the tools collection
    const toolsCollection = await chromaClient.getCollection({
      name: 'generated_tools'
    });
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query, openai);
    
    // Search for similar tools
    const results = await toolsCollection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      include: ['metadatas', 'documents', 'distances']
    });

    if (results.ids[0] && results.ids[0].length > 0) {
      console.log(`\n📋 Found ${results.ids[0].length} matching tools:\n`);
      
      results.ids[0].forEach((id, index) => {
        const metadata = results.metadatas[0][index];
        const distance = results.distances[0][index];
        const tool = results.documents[0][index];
        
        // Skip if any required data is missing
        if (!metadata || !distance || !tool) {
          console.log(`   ⚠️ Skipping result ${index + 1} due to missing data`);
          return;
        }
        
        const similarity = 1 - distance;
        const parsedTool = JSON.parse(tool);
        
        console.log(`${index + 1}. ${metadata.name} (similarity: ${(similarity * 100).toFixed(1)}%)`);
        console.log(`   Description: ${metadata.description}`);
        console.log(`   Method: ${metadata.method} | Path: ${metadata.path}`);
        if (metadata.tags && metadata.tags !== '') {
          console.log(`   Tags: ${metadata.tags}`);
        }
        console.log(`   Source: ${metadata.source}`);
        console.log('');
      });
    } else {
      console.log('❌ No matching tools found');
    }
    
  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

async function listChromaDBCollections(): Promise<void> {
  try {
    const chromaClient = new ChromaClient({ path: 'http://localhost:8000' });
    await chromaClient.heartbeat();
    
    const collections = await chromaClient.listCollections();
    console.log('📚 ChromaDB Collections:');
    
    for (const collection of collections) {
      const count = await collection.count();
      console.log(`   ${collection.name}: ${count} items`);
      if (collection.metadata) {
        console.log(`      Description: ${collection.metadata.description || 'No description'}`);
        console.log(`      Source: ${collection.metadata.source || 'Unknown'}`);
        console.log(`      Generated: ${collection.metadata.generatedAt || 'Unknown'}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Failed to list collections:', error);
  }
}

// CLI Commands
program
  .name('one-place-chat-tools')
  .description('Generate and manage API tools with ChromaDB integration')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate tools from OpenAPI specification and store in ChromaDB')
  .argument('<spec-path>', 'Path to OpenAPI specification file')
  .option('--no-chromadb', 'Skip ChromaDB integration')
  .action(async (specPath, options) => {
    await generateToolsWithChromaDB(
      specPath, 
      './chromadb-storage', // Placeholder, not used
      true, // Placeholder, not used
      options.chromadb
    );
  });

program
  .command('search')
  .description('Search for tools using semantic similarity')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Maximum number of results', '5')
  .action(async (query, options) => {
    await searchTools(query, parseInt(options.limit));
  });

program
  .command('list-collections')
  .description('List all ChromaDB collections')
  .action(async () => {
    await listChromaDBCollections();
  });

program.parse();
