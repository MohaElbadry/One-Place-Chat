import { ToolEmbeddingMatcher } from './ToolEmbeddingMatcher.js';
import { MCPTool } from '../types/api.types.js';
import { MatchResult, ScoredTool } from '../types/llm.types.js';

/**
 * Semantic tool matcher that uses embeddings and keyword matching to find the best API tool.
 * Extends ToolEmbeddingMatcher for advanced matching capabilities.
 */
export class ToolSemanticMatcher extends ToolEmbeddingMatcher {
  private _initialized: boolean = false;

  constructor(apiKey?: string) {
    super(apiKey);
  }

  /**
   * Find the best matching tool for a given query using embeddings.
   */
  async findBestMatch(message: string, tools?: MCPTool[]): Promise<MatchResult | null> {
    if (tools && !this._initialized) {
      await this.initialize(tools);
      this._initialized = true;
    }
    
    if (!this.isInitialized) {
      throw new Error('Tool matcher not initialized. Call initialize() first.');
    }

    try {
      // Use embedding-based matching
      const queryEmbedding = await this.embed(message);
      let bestMatch: MatchResult | null = null;
      let bestScore = 0;

      for (const tool of this.tools) {
        const semanticScore = this.cosine(queryEmbedding, tool.embedding);
        const keywordScore = this.calculateKeywordScore(message, tool);
        const intentScore = this.calculateIntentScore(tool, this.detectIntent(message));
        const pathScore = this.calculatePathScore(message, tool);
        
        // Weighted combination of scores
        const totalScore = (semanticScore * 0.5) + (keywordScore * 0.3) + (intentScore * 0.15) + (pathScore * 0.05);
        
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestMatch = {
            tool: tool,
            parameters: this.extractParameters(message, tool),
            confidence: totalScore,
            reasoning: `Matched using embeddings (semantic: ${semanticScore.toFixed(2)}, keyword: ${keywordScore.toFixed(2)}, intent: ${intentScore.toFixed(2)})`
          };
        }
      }

      return bestMatch && bestScore > 0.3 ? bestMatch : null;
    } catch (error) {
      console.error('Error in embedding-based matching:', error);
      // Fallback to keyword matching
      return this.fallbackKeywordMatching(message, tools || []);
    }
  }

  /**
   * Find similar tools for a given query using embeddings.
   */
  async findSimilarTools(query: string, limit: number = 3, tools?: MCPTool[]): Promise<ScoredTool[]> {
    if (tools && !this._initialized) {
      await this.initialize(tools);
      this._initialized = true;
    }

    if (!this.isInitialized) {
      throw new Error('Tool matcher not initialized. Call initialize() first.');
    }

    try {
      const queryEmbedding = await this.embed(query);
      const scoredTools: ScoredTool[] = [];

      for (const tool of this.tools) {
        const semanticScore = this.cosine(queryEmbedding, tool.embedding);
        const keywordScore = this.calculateKeywordScore(query, tool);
        const intentScore = this.calculateIntentScore(tool, this.detectIntent(query));
        const pathScore = this.calculatePathScore(query, tool);
        
        const totalScore = (semanticScore * 0.5) + (keywordScore * 0.3) + (intentScore * 0.15) + (pathScore * 0.05);
        
        if (totalScore > 0.1) {
          scoredTools.push({
            tool: tool,
            score: totalScore,
            matchDetails: {
              semanticScore,
              keywordScore,
              intentScore,
              pathScore
            }
          });
        }
      }

      return scoredTools
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Error in embedding-based similarity search:', error);
      return [];
    }
  }

  /**
   * Calculate keyword-based score as fallback.
   */
  private calculateKeywordScore(query: string, tool: MCPTool): number {
    const toolText = `${tool.name} ${tool.description || ''} ${tool.endpoint?.path || ''}`.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/);
    const toolWords = toolText.split(/\s+/);
    
    let matches = 0;
    for (const queryWord of queryWords) {
      if (queryWord.length > 2 && toolWords.some(toolWord => toolWord.includes(queryWord))) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  /**
   * Calculate path-based score.
   */
  private calculatePathScore(query: string, tool: MCPTool): number {
    const path = tool.endpoint?.path || '';
    const queryLower = query.toLowerCase();
    
    // Check if query mentions path components
    const pathParts = path.split('/').filter(part => part.length > 0);
    let matches = 0;
    
    for (const part of pathParts) {
      const cleanPart = part.replace(/[{}]/g, '').toLowerCase();
      if (queryLower.includes(cleanPart)) {
        matches++;
      }
    }
    
    return matches / Math.max(pathParts.length, 1);
  }

  /**
   * Fallback to simple keyword matching if embeddings fail.
   */
  private fallbackKeywordMatching(message: string, tools: MCPTool[]): MatchResult | null {
    const query = message.toLowerCase();
    let bestMatch: MatchResult | null = null;
    let bestScore = 0;

    for (const tool of tools) {
      const score = this.calculateKeywordScore(query, tool);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          tool,
          parameters: this.extractParameters(query, tool),
          confidence: score,
          reasoning: `Fallback keyword matching for: "${query}"`
        };
      }
    }

    return bestMatch && bestScore > 0.3 ? bestMatch : null;
  }

  /**
   * Extract parameters from query using pattern matching.
   */
  private extractParameters(query: string, tool: MCPTool): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Extract key=value patterns
    const keyValueMatches = query.match(/(\w+)\s*[:=]\s*([^\s,]+)/g);
    if (keyValueMatches) {
      for (const match of keyValueMatches) {
        const [key, value] = match.split(/[:=]\s*/);
        if (key && value) {
          params[key.trim()] = value.trim();
        }
      }
    }
    
    // Extract common patterns like "id 5", "name fluffy"
    const patterns = [
      /(\w+)\s+(\d+)/g,  // id 5, user 123
      /(\w+)\s+([a-zA-Z][a-zA-Z0-9\s]*)/g,  // name fluffy, status available
    ];
    
    for (const pattern of patterns) {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        const [, key, value] = match;
        if (key && value && !params[key]) {
          params[key.trim()] = value.trim();
        }
      }
    }
    
    return params;
  }
}
