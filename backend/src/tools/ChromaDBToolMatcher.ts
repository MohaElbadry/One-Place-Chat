import { ChromaDBService } from '../database/ChromaDBService.js';
import { MCPTool } from '../types/api.types.js';
import { MatchResult, ScoredTool } from '../types/llm.types.js';
import OpenAI from 'openai';

/**
 * ChromaDB-based tool matcher that uses vector similarity search for finding the best API tools.
 * This replaces the old embedding matcher with a more scalable and accurate approach.
 */
export class ChromaDBToolMatcher {
  private chromaService: ChromaDBService;
  private openai: OpenAI | null = null;
  private _initialized: boolean = false;
  private tools: MCPTool[] = [];

  constructor(openaiApiKey?: string) {
    this.chromaService = new ChromaDBService();
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  /**
   * Initialize the ChromaDB service and store tool embeddings
   */
  async initialize(tools: MCPTool[]): Promise<void> {
    try {
      this.tools = tools;
      
      // Initialize ChromaDB
      await this.chromaService.initialize();
      
      // Check if we already have tools stored
      const existingTools = await this.chromaService.getAllTools();
      
      if (existingTools.length === 0) {
        console.log('🔄 No existing tools found in ChromaDB, generating embeddings...');
        await this.generateAndStoreToolEmbeddings(tools);
      } else {
        console.log(`✅ Found ${existingTools.length} existing tools in ChromaDB`);
        // Verify all current tools are stored
        const currentToolIds = new Set(tools.map(t => t.name));
        const storedToolIds = new Set(existingTools.map(t => t.tool.name));
        
        const missingTools = tools.filter(t => !storedToolIds.has(t.name));
        if (missingTools.length > 0) {
          console.log(`🔄 Adding ${missingTools.length} new tools to ChromaDB...`);
          await this.generateAndStoreToolEmbeddings(missingTools);
        }
      }
      
      this._initialized = true;
      console.log('✅ ChromaDB tool matcher initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ChromaDB tool matcher:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for tools and store them in ChromaDB
   */
  private async generateAndStoreToolEmbeddings(tools: MCPTool[]): Promise<void> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Please provide an API key.');
    }

    for (const tool of tools) {
      try {
        // Create text representation for embedding
        const toolText = [
          tool.name || 'unnamed',
          tool.description || '',
          tool.annotations?.method || '',
          tool.annotations?.path || '',
          (tool.annotations?.tags || []).join(' ')
        ].filter(Boolean).join(' ');

        // Generate embedding using OpenAI
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: toolText
        });
        
        const embedding = response.data[0].embedding;
        
        // Store in ChromaDB
        await this.chromaService.storeToolEmbedding(tool, embedding);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to generate embedding for tool ${tool.name}:`, error);
      }
    }
  }

  /**
   * Find the best matching tool for a given query using ChromaDB similarity search
   */
  async findBestMatch(message: string, tools?: MCPTool[]): Promise<MatchResult | null> {
    if (!this._initialized) {
      throw new Error('ChromaDB tool matcher not initialized. Call initialize() first.');
    }

    try {
      // Generate embedding for the query
      if (!this.openai) {
        throw new Error('OpenAI client not initialized. Please provide an API key.');
      }

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: message
      });
      
      const queryEmbedding = response.data[0].embedding;

      // Search for similar tools in ChromaDB
      const similarTools = await this.chromaService.findSimilarTools(message, queryEmbedding, 5);

      if (similarTools.length === 0) {
        return null;
      }

      // Get the best match
      const bestMatch = similarTools[0];
      
      // Convert to MatchResult format
      const matchResult: MatchResult = {
        tool: bestMatch.tool,
        parameters: this.extractParameters(message, bestMatch.tool),
        confidence: bestMatch.similarity, // Use similarity score from ChromaDB
        reasoning: `Matched using ChromaDB vector similarity (score: ${bestMatch.similarity.toFixed(2)})`
      };

      return matchResult;
    } catch (error) {
      console.error('Error in ChromaDB-based matching:', error);
      return null;
    }
  }

  /**
   * Find similar tools for a given query using ChromaDB
   */
  async findSimilarTools(query: string, limit: number = 3, tools?: MCPTool[]): Promise<ScoredTool[]> {
    if (!this._initialized) {
      throw new Error('ChromaDB tool matcher not initialized. Call initialize() first.');
    }

    try {
      // Generate embedding for the query
      if (!this.openai) {
        throw new Error('OpenAI client not initialized. Please provide an API key.');
      }

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: query
      });
      
      const queryEmbedding = response.data[0].embedding;

      // Search for similar tools in ChromaDB
      const similarTools = await this.chromaService.findSimilarTools(query, queryEmbedding, limit);

      // Convert to ScoredTool format
      return similarTools.map(tool => ({
        tool: tool.tool,
        score: tool.similarity,
        matchDetails: {
          semanticScore: tool.similarity,
          keywordScore: 0, // ChromaDB handles this through embeddings
          intentScore: 0,
          pathScore: 0
        }
      }));
    } catch (error) {
      console.error('Error in ChromaDB-based similarity search:', error);
      return [];
    }
  }

  /**
   * Extract parameters from user input for a specific tool
   */
  private extractParameters(message: string, tool: MCPTool): Record<string, any> {
    // This is a simplified parameter extraction - you can enhance this
    const parameters: Record<string, any> = {};
    
    // Extract path parameters from the tool's path
    const pathParams = tool.annotations?.path?.match(/\{([^}]+)\}/g) || [];
    const pathParamNames = pathParams.map(param => param.slice(1, -1));
    
    // For now, return empty parameters - the ConversationalEngine will handle parameter extraction
    return parameters;
  }

  /**
   * Check if the matcher is initialized
   */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Get all stored tools
   */
  async getAllTools(): Promise<MCPTool[]> {
    if (!this._initialized) {
      throw new Error('ChromaDB tool matcher not initialized. Call initialize() first.');
    }

    const toolEmbeddings = await this.chromaService.getAllTools();
    return toolEmbeddings.map(te => te.tool);
  }

  /**
   * Clear all stored tools (useful for testing)
   */
  async clearAllTools(): Promise<void> {
    if (!this._initialized) {
      throw new Error('ChromaDB tool matcher not initialized. Call initialize() first.');
    }

    await this.chromaService.clearAllData();
  }

  /**
   * Close the ChromaDB connection
   */
  async close(): Promise<void> {
    await this.chromaService.close();
  }
}
