import { ChromaDBService } from '../database/ChromaDBService.js';
import { MCPTool } from '../types/api.types.js';

/**
 * ChromaDB-based tool loader that retrieves tools directly from the vector database
 * instead of reading from local files.
 */
export class ChromaDBToolLoader {
  private chromaService: ChromaDBService;
  private tools: MCPTool[] = [];
  private loaded = false;

  constructor() {
    this.chromaService = new ChromaDBService();
  }

  /**
   * Load tools directly from ChromaDB
   */
  async loadTools(): Promise<MCPTool[]> {
    if (this.loaded) return this.tools;
    
    try {
      // Initialize ChromaDB connection
      await this.chromaService.initialize();
      
      // Get all tools from the generated_tools collection
      console.log('🔍 Attempting to load tools from generated_tools collection...');
      const toolEmbeddings = await this.chromaService.getToolsFromCollection('generated_tools');
      console.log(`📊 Found ${toolEmbeddings.length} tool embeddings`);
      
      // Extract the actual MCPTool objects
      this.tools = toolEmbeddings.map(te => te.tool);
      console.log(`🔧 Extracted ${this.tools.length} MCPTool objects`);
      
      this.loaded = true;
      console.log(`✅ Loaded ${this.tools.length} tools from ChromaDB`);
      return this.tools;
    } catch (error) {
      console.error('❌ Error loading tools from ChromaDB:', error);
      
      // If ChromaDB is empty or not accessible, return empty array
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not initialized') || errorMessage.includes('No results')) {
        console.log('ℹ️ ChromaDB is empty or not accessible. No tools loaded.');
        this.tools = [];
        this.loaded = true;
        return this.tools;
      }
      
      throw error;
    }
  }

  /**
   * Get all loaded tools
   */
  getTools(): MCPTool[] {
    return [...this.tools];
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.find(tool => tool.name === name);
  }

  /**
   * Search tools using ChromaDB semantic search
   */
  async searchTools(query: string, limit: number = 5): Promise<MCPTool[]> {
    try {
      // Try to search, if it fails due to not being initialized, initialize first
      try {
        const simpleEmbedding = this.generateSimpleEmbedding(query);
        const similarTools = await this.chromaService.findSimilarTools(query, simpleEmbedding, limit);
        return similarTools.map(te => te.tool);
      } catch (initError) {
        // If not initialized, try to initialize and search again
        await this.chromaService.initialize();
        const simpleEmbedding = this.generateSimpleEmbedding(query);
        const similarTools = await this.chromaService.findSimilarTools(query, simpleEmbedding, limit);
        return similarTools.map(te => te.tool);
      }
    } catch (error) {
      console.error('Error searching tools:', error);
      // Fallback to basic text search
      return this.basicTextSearch(query);
    }
  }

  /**
   * Basic text-based search as fallback
   */
  private basicTextSearch(query: string): MCPTool[] {
    const lowerQuery = query.toLowerCase();
    return this.tools.filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      (tool.description && tool.description.toLowerCase().includes(lowerQuery)) ||
      (tool.annotations?.path && tool.annotations.path.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Check if tools are loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.length;
  }

  /**
   * Get tools by category (if metadata supports it)
   */
  async getToolsByCategory(category: string): Promise<MCPTool[]> {
    try {
      // Try to get tools, if it fails due to not being initialized, initialize first
      try {
        // This would require extending ChromaDBService to support category filtering
        // For now, return all tools
        return this.tools;
      } catch (initError) {
        // If not initialized, try to initialize
        await this.chromaService.initialize();
        return this.tools;
      }
    } catch (error) {
      console.error('Error getting tools by category:', error);
      return this.tools;
    }
  }

  /**
   * Refresh tools from ChromaDB
   */
  async refreshTools(): Promise<MCPTool[]> {
    this.loaded = false;
    return await this.loadTools();
  }

  /**
   * Generate simple embedding for text (fallback method)
   */
  private generateSimpleEmbedding(text: string): number[] {
    const hash = this.simpleHash(text);
    const embedding = new Array(1536).fill(0);
    
    for (let i = 0; i < Math.min(hash.length, embedding.length); i++) {
      embedding[i] = (hash.charCodeAt(i) - 128) / 128;
    }
    
    return embedding;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * Close ChromaDB connection
   */
  async close(): Promise<void> {
    await this.chromaService.close();
  }
}
