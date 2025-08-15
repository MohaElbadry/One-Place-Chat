import OpenAI from 'openai';
import { MCPTool } from '../types/api.types.js';
import { MatchResult, ScoredTool } from '../types/llm.types.js';
import { ChromaDBService, ToolEmbedding } from '../database/ChromaDBService.js';

export class ToolEmbeddingMatcherChroma {
  private openai!: OpenAI;
  private chromaService: ChromaDBService;
  private llmEnabled: boolean = true;
  private isInitialized: boolean = false;
  private toolIndex: Map<string, MCPTool> = new Map();
  private keywordIndex: Map<string, MCPTool[]> = new Map();

  private metrics = {
    totalQueries: 0,
    cacheHits: 0,
    embeddingRequests: 0,
    averageResponseTime: 0
  };

  constructor(apiKey: string | undefined, chromaService: ChromaDBService) {
    this.chromaService = chromaService;
    
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.llmEnabled = false;
      console.warn('⚠️ OpenAI API key not provided, falling back to keyword matching only');
    }
  }

  async initialize(rawTools: MCPTool[]): Promise<void> {
    try {
      console.log('🧠 Initializing ChromaDB-based tool matcher...');
      
      // Initialize ChromaDB
      await this.chromaService.initialize();
      
      // Check if tools already exist in ChromaDB
      const existingTools = await this.chromaService.getAllTools();
      
      if (existingTools.length === 0) {
        console.log('📝 No existing tools found, generating embeddings for all tools...');
        await this.generateAndStoreEmbeddings(rawTools);
      } else {
        console.log(`✅ Found ${existingTools.length} existing tools in ChromaDB`);
        // Load tools from ChromaDB
        rawTools = existingTools.map(te => te.tool);
      }

      // Build local indexes for fast access
      this.buildIndexes(rawTools);
      
      this.isInitialized = true;
      console.log('✅ ChromaDB-based tool matcher initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ChromaDB-based tool matcher:', error);
      throw error;
    }
  }

  private async generateAndStoreEmbeddings(tools: MCPTool[]): Promise<void> {
    if (!this.llmEnabled) {
      console.warn('⚠️ Cannot generate embeddings without OpenAI API key');
      return;
    }

    console.log(`🔄 Generating embeddings for ${tools.length} tools...`);
    
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      try {
        const embedding = await this.embed(this.serializeTool(tool));
        await this.chromaService.storeToolEmbedding(tool, embedding);
        
        if ((i + 1) % 10 === 0) {
          console.log(`📊 Processed ${i + 1}/${tools.length} tools`);
        }
      } catch (error) {
        console.error(`❌ Failed to generate embedding for tool ${tool.name}:`, error);
      }
    }
    
    console.log('✅ All tool embeddings generated and stored');
  }

  async findBestMatch(message: string, tools?: MCPTool[]): Promise<MatchResult | null> {
    if (!this.isInitialized) {
      throw new Error('ToolEmbeddingMatcher not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embed(message);
      
      // Find similar tools using ChromaDB
      const similarTools = await this.chromaService.findSimilarTools(message, queryEmbedding, 5);
      
      if (similarTools.length === 0) {
        return null;
      }

      // Calculate confidence scores
      const scoredTools: ScoredTool[] = similarTools.map(toolEmbedding => {
        const semanticScore = this.calculateSemanticScore(message, toolEmbedding.tool);
        const keywordScore = this.calculateKeywordScore(message, toolEmbedding.tool);
        const intentScore = this.calculateIntentScore(toolEmbedding.tool, this.detectIntent(message));
        const pathScore = this.calculatePathScore(message, toolEmbedding.tool);

        const totalScore = (semanticScore * 0.4) + (keywordScore * 0.3) + (intentScore * 0.2) + (pathScore * 0.1);

        return {
          tool: toolEmbedding.tool,
          score: totalScore,
          matchDetails: {
            semanticScore,
            keywordScore,
            intentScore,
            pathScore
          }
        };
      });

      // Sort by score and get the best match
      scoredTools.sort((a, b) => b.score - a.score);
      const bestMatch = scoredTools[0];

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + responseTime) / this.metrics.totalQueries;

      return {
        tool: bestMatch.tool,
        parameters: this.extractParameters(message, bestMatch.tool),
        confidence: bestMatch.score,
        reasoning: `Best match: ${bestMatch.tool.name} (score: ${bestMatch.score.toFixed(3)})`,
        alternativeTools: scoredTools.slice(1, 3).map(st => st.tool)
      };
    } catch (error) {
      console.error('Error in findBestMatch:', error);
      return null;
    }
  }

  async findSimilarTools(query: string, limit: number = 3, tools?: MCPTool[]): Promise<ScoredTool[]> {
    if (!this.isInitialized) {
      throw new Error('ToolEmbeddingMatcher not initialized');
    }

    try {
      const queryEmbedding = await this.embed(query);
      const similarTools = await this.chromaService.findSimilarTools(query, queryEmbedding, limit);
      
      return similarTools.map(toolEmbedding => {
        const semanticScore = this.calculateSemanticScore(query, toolEmbedding.tool);
        const keywordScore = this.calculateKeywordScore(query, toolEmbedding.tool);
        const intentScore = this.calculateIntentScore(toolEmbedding.tool, this.detectIntent(query));
        const pathScore = this.calculatePathScore(query, toolEmbedding.tool);

        const totalScore = (semanticScore * 0.4) + (keywordScore * 0.3) + (intentScore * 0.2) + (pathScore * 0.1);

        return {
          tool: toolEmbedding.tool,
          score: totalScore,
          matchDetails: {
            semanticScore,
            keywordScore,
            intentScore,
            pathScore
          }
        };
      });
    } catch (error) {
      console.error('Error in findSimilarTools:', error);
      return [];
    }
  }

  // Helper methods
  private async embed(text: string): Promise<number[]> {
    if (!this.llmEnabled) {
      throw new Error('OpenAI API not available for embedding generation');
    }

    this.metrics.embeddingRequests++;
    
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  private serializeTool(tool: MCPTool): string {
    return `${tool.name} ${tool.description} ${tool.annotations.tags?.join(' ') || ''} ${tool.annotations.method} ${tool.annotations.path}`;
  }

  private buildIndexes(tools: MCPTool[]): void {
    this.toolIndex.clear();
    this.keywordIndex.clear();

    tools.forEach(tool => {
      this.toolIndex.set(tool.name, tool);
      this.indexToolKeywords(tool);
    });
  }

  private indexToolKeywords(tool: MCPTool): void {
    const keywords = this.extractKeywords(tool);
    keywords.forEach(keyword => {
      if (!this.keywordIndex.has(keyword)) {
        this.keywordIndex.set(keyword, []);
      }
      this.keywordIndex.get(keyword)!.push(tool);
    });
  }

  private extractKeywords(tool: MCPTool): string[] {
    const text = `${tool.name} ${tool.description} ${tool.annotations.tags?.join(' ') || ''}`;
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isStopWord(word));
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return stopWords.includes(word);
  }

  private detectIntent(query: string): 'create' | 'read' | 'update' | 'delete' | 'other' {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('create') || lowerQuery.includes('add') || lowerQuery.includes('new')) return 'create';
    if (lowerQuery.includes('get') || lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('read')) return 'read';
    if (lowerQuery.includes('update') || lowerQuery.includes('modify') || lowerQuery.includes('change')) return 'update';
    if (lowerQuery.includes('delete') || lowerQuery.includes('remove') || lowerQuery.includes('drop')) return 'delete';
    return 'other';
  }

  private calculateSemanticScore(query: string, tool: MCPTool): number {
    // This would be calculated using the actual embeddings from ChromaDB
    // For now, return a base score
    return 0.7;
  }

  private calculateKeywordScore(query: string, tool: MCPTool): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const toolKeywords = this.extractKeywords(tool);
    
    const matches = queryWords.filter(word => 
      toolKeywords.some(keyword => keyword.includes(word) || word.includes(keyword))
    );
    
    return Math.min(matches.length / queryWords.length, 1.0);
  }

  private calculateIntentScore(tool: MCPTool, intent: string): number {
    const method = tool.annotations.method.toLowerCase();
    
    switch (intent) {
      case 'create': return method === 'post' ? 1.0 : 0.0;
      case 'read': return method === 'get' ? 1.0 : 0.0;
      case 'update': return method === 'put' || method === 'patch' ? 1.0 : 0.0;
      case 'delete': return method === 'delete' ? 1.0 : 0.0;
      default: return 0.5;
    }
  }

  private calculatePathScore(query: string, tool: MCPTool): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const pathParts = tool.annotations.path.toLowerCase().split('/').filter(part => part.length > 0);
    
    const matches = queryWords.filter(word => 
      pathParts.some(part => part.includes(word) || word.includes(part))
    );
    
    return Math.min(matches.length / Math.max(queryWords.length, 1), 1.0);
  }

  private extractParameters(query: string, tool: MCPTool): Record<string, any> {
    // Basic parameter extraction - you can enhance this with LLM
    const params: Record<string, any> = {};
    
    // Extract path parameters
    const pathParams = tool.endpoint.parameters?.filter(p => p.in === 'path') || [];
    pathParams.forEach(param => {
      const regex = new RegExp(`\\b${param.name}\\b`, 'i');
      if (regex.test(query)) {
        params[param.name] = true; // Just mark as present for now
      }
    });
    
    return params;
  }

  // Database operations
  async addTool(tool: MCPTool): Promise<void> {
    if (!this.isInitialized) throw new Error('ToolEmbeddingMatcher not initialized');
    
    const embedding = await this.embed(this.serializeTool(tool));
    await this.chromaService.storeToolEmbedding(tool, embedding);
    
    // Update local indexes
    this.toolIndex.set(tool.name, tool);
    this.indexToolKeywords(tool);
  }

  async updateTool(tool: MCPTool): Promise<void> {
    if (!this.isInitialized) throw new Error('ToolEmbeddingMatcher not initialized');
    
    // Find existing tool in ChromaDB and update
    const existingTools = await this.chromaService.getAllTools();
    const existing = existingTools.find(te => te.tool.name === tool.name);
    
    if (existing) {
      const embedding = await this.embed(this.serializeTool(tool));
      await this.chromaService.updateToolEmbedding(existing.id, tool, embedding);
    } else {
      await this.addTool(tool);
    }
    
    // Update local indexes
    this.toolIndex.set(tool.name, tool);
    this.indexToolKeywords(tool);
  }

  async removeTool(toolName: string): Promise<void> {
    if (!this.isInitialized) throw new Error('ToolEmbeddingMatcher not initialized');
    
    const existingTools = await this.chromaService.getAllTools();
    const existing = existingTools.find(te => te.tool.name === toolName);
    
    if (existing) {
      await this.chromaService.deleteTool(existing.id);
    }
    
    // Update local indexes
    this.toolIndex.delete(toolName);
    // Rebuild keyword index
    this.keywordIndex.clear();
    const remainingTools = Array.from(this.toolIndex.values());
    remainingTools.forEach(tool => this.indexToolKeywords(tool));
  }

  // Metrics and monitoring
  getMetrics() {
    return { ...this.metrics };
  }

  async getDatabaseStats() {
    return await this.chromaService.getDatabaseStats();
  }

  async close(): Promise<void> {
    await this.chromaService.close();
  }
}
