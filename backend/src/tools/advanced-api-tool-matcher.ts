import { MCPTool } from '../types.js';
import OpenAI from 'openai';

export interface MatchResult {
  tool: MCPTool;
  parameters: Record<string, any>;
  confidence: number;
  reasoning: string;
  alternativeTools?: MCPTool[];
}

type ToolWithEmb = MCPTool & { 
  embedding: number[];
  embeddingHash?: string; // For cache validation
};

export interface ScoredTool {
  tool: MCPTool;
  score: number;
  matchDetails: {
    semanticScore: number;
    keywordScore: number;
    intentScore: number;
    pathScore: number;
  };
}

// In-memory cache for query embeddings
interface QueryCache {
  [query: string]: {
    embedding: number[];
    timestamp: number;
    hitCount: number;
  };
}

export class AdvancedAPIToolMatcher {
  private openai!: OpenAI;
  private tools: ToolWithEmb[] = [];
  private llmEnabled: boolean = true;
  private isInitialized: boolean = false;
  private toolIndex: Map<string, MCPTool> = new Map();
  private keywordIndex: Map<string, MCPTool[]> = new Map();
  
  // Enhanced in-memory caching
  private queryCache: QueryCache = {};
  private readonly MAX_CACHE_SIZE = 100; // Limit cache size
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private cacheCleanupInterval?: NodeJS.Timeout;

  // Performance metrics (optional)
  private metrics = {
    totalQueries: 0,
    cacheHits: 0,
    embeddingCalls: 0,
    averageResponseTime: 0
  };

  constructor(apiKey: string | undefined) {
    if (!apiKey && !process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API disabled – no API key provided. Falling back to keyword matching only.');
      this.llmEnabled = false;
    } else {
      this.openai = new OpenAI({ 
        apiKey: apiKey || process.env.OPENAI_API_KEY 
      });
    }

    // Start cache cleanup interval (every 15 minutes)
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 15 * 60 * 1000);
  }

  /**
   * Clean up expired cache entries and manage cache size
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entries = Object.entries(this.queryCache);
    
    // Remove expired entries
    const validEntries = entries.filter(([_, data]) => 
      now - data.timestamp < this.CACHE_TTL
    );

    // If still too many, keep the most frequently used ones
    if (validEntries.length > this.MAX_CACHE_SIZE) {
      validEntries.sort((a, b) => b[1].hitCount - a[1].hitCount);
      validEntries.splice(this.MAX_CACHE_SIZE);
    }

    // Rebuild cache
    this.queryCache = {};
    validEntries.forEach(([query, data]) => {
      this.queryCache[query] = data;
    });

    console.log(`Cache cleaned up. Kept ${validEntries.length} entries.`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: Object.keys(this.queryCache).length,
      hitRate: this.metrics.totalQueries > 0 
        ? (this.metrics.cacheHits / this.metrics.totalQueries * 100).toFixed(1) + '%'
        : '0%',
      totalQueries: this.metrics.totalQueries,
      cacheHits: this.metrics.cacheHits,
      embeddingCalls: this.metrics.embeddingCalls,
      averageResponseTime: this.metrics.averageResponseTime.toFixed(2) + 'ms'
    };
  }

  /**
   * Clear all caches (useful for testing or memory management)
   */
  clearCache(): void {
    this.queryCache = {};
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      embeddingCalls: 0,
      averageResponseTime: 0
    };
    console.log('All caches cleared');
  }

  /**
   * Generate a simple hash for tool content to detect changes
   */
  private generateToolHash(tool: MCPTool): string {
    const content = this.serializeTool(tool);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  async initialize(rawTools: MCPTool[]): Promise<void> {
    if (!rawTools?.length) {
      throw new Error('No tools provided for initialization');
    }
    
    const filtered = rawTools.filter(tool => 
      tool?.name && 
      tool?.endpoint && 
      tool.endpoint.method && 
      tool.endpoint.path
    );

    console.log(`Initializing ${filtered.length} tools with in-memory embeddings...`);
    const startTime = Date.now();

    // Build embeddings if LLM is enabled
    if (this.llmEnabled) {
      this.tools = await Promise.all(
        filtered.map(async (tool, index) => {
          const hash = this.generateToolHash(tool);
          
          // Check if we already have this exact tool cached
          const existingTool = this.tools.find(t => 
            t.name === tool.name && t.embeddingHash === hash
          );
          
          if (existingTool) {
            console.log(`Using cached embedding for tool: ${tool.name}`);
            return existingTool;
          }

          // Generate new embedding
          console.log(`Generating embedding for tool ${index + 1}/${filtered.length}: ${tool.name}`);
          const embedding = await this.embed(this.serializeTool(tool));
          
          return {
            ...tool,
            embedding,
            embeddingHash: hash
          };
        })
      );
    } else {
      // No embeddings, just add empty arrays
      this.tools = filtered.map(tool => ({ 
        ...tool, 
        embedding: [],
        embeddingHash: this.generateToolHash(tool)
      }));
    }

    this.buildIndexes();
    this.isInitialized = true;
    
    const initTime = Date.now() - startTime;
    console.log(`Tool matcher initialized in ${initTime}ms. Embeddings stored in memory.`);
  }

  private serializeTool(tool: MCPTool): string {
    return [
      tool.name,
      tool.description || '',
      tool.endpoint?.method || '',
      tool.endpoint?.path || '',
      JSON.stringify(tool.inputSchema?.properties || {})
    ].join(' ').slice(0, 4096);
  }

  private buildIndexes(): void {
    this.toolIndex.clear();
    this.keywordIndex.clear();

    this.tools.forEach(tool => {
      this.toolIndex.set(tool.name.toLowerCase(), tool);
      this.indexToolKeywords(tool);
    });
  }

  private async embed(text: string): Promise<number[]> {
    if (!this.llmEnabled) return [];
    
    try {
      this.metrics.embeddingCalls++;
      const { data } = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 4096)
      });
      return data[0].embedding;
    } catch (error) {
      console.warn('Failed to generate embedding:', error);
      return [];
    }
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
    const text = [
      tool.name,
      tool.description || '',
      tool.endpoint?.path || '',
      tool.endpoint?.method || ''
    ].join(' ').toLowerCase();

    return text
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 2 && !this.isStopWord(word));
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can'];
    return stopWords.includes(word);
  }

  async findBestMatch(message: string): Promise<MatchResult | null> {
    const startTime = Date.now();
    this.metrics.totalQueries++;

    if (!this.isInitialized || this.tools.length === 0) {
      throw new Error('Tool matcher not initialized with tools');
    }

    try {
      const candidates = await this.getTopCandidates(message, 5);
      
      if (candidates.length === 0) {
        return this.createFallbackResult();
      }

      // Use LLM for final selection among top candidates
      let bestMatch: MatchResult | null = null;
      
      if (this.llmEnabled) {
        bestMatch = await this.llmBasedSelection(message, candidates);
      }
      
      if (bestMatch) {
        const alternativeTools = candidates
          .filter(c => c.tool.name !== bestMatch!.tool.name)
          .slice(0, 3)
          .map(c => c.tool);

        bestMatch.alternativeTools = alternativeTools;
      } else {
        bestMatch = this.createResultFromCandidate(candidates[0]);
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + responseTime) / this.metrics.totalQueries;

      return bestMatch;

    } catch (error) {
      console.error('Error in tool matching:', error);
      return this.fallbackMatch(message);
    }
  }

  private detectIntent(query: string): 'create'|'read'|'update'|'delete'|'other' {
    const verbs = {
      create: /\b(create|add|make|post|generate|new)\b/i,
      read:   /\b(get|show|fetch|list|retrieve|search|find|view)\b/i,
      update: /\b(update|edit|modify|change|patch|put)\b/i,
      delete: /\b(delete|remove|destroy|clear)\b/i
    };
    
    for (const [intent, rx] of Object.entries(verbs)) {
      if (rx.test(query)) return intent as any;
    }
    return 'other';
  }

  private calculateIntentScore(tool: MCPTool, intent: string): number {
    const method = tool.endpoint.method.toLowerCase();
    
    const perfectMatch = (
      (intent === 'create' && method === 'post') ||
      (intent === 'read' && method === 'get') ||
      (intent === 'update' && (method === 'put' || method === 'patch')) ||
      (intent === 'delete' && method === 'delete')
    );
    
    return perfectMatch ? 1.0 : 0.0;
  }

  private async getTopCandidates(message: string, limit: number = 5): Promise<ScoredTool[]> {
    const query = message.toLowerCase().trim();
    const scoredTools: ScoredTool[] = [];

    // Get query embedding with caching
    const queryEmbedding = this.llmEnabled ? await this.getQueryEmbedding(query) : [];
    const intent = this.detectIntent(query);

    for (const tool of this.tools) {
      const matchDetails = {
        semanticScore: this.calculateSemanticScore(tool, queryEmbedding),
        keywordScore: this.calculateKeywordScore(tool, query),
        intentScore: this.calculateIntentScore(tool, intent),
        pathScore: this.calculatePathScore(tool, query)
      };

      const totalScore = (
        matchDetails.semanticScore * 0.5 +  // Balanced weights
        matchDetails.intentScore   * 0.25 +
        matchDetails.keywordScore  * 0.15 +
        matchDetails.pathScore     * 0.1
      );

      if (totalScore > 0.1) {
        scoredTools.push({
          tool,
          score: totalScore,
          matchDetails
        });
      }
    }

    return scoredTools
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private cosine(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;
    
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na  += a[i] * a[i];
      nb  += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  }

  /**
   * Enhanced query embedding with in-memory caching
   */
  private async getQueryEmbedding(query: string): Promise<number[]> {
    // Check cache first
    const cached = this.queryCache[query];
    if (cached) {
      cached.hitCount++;
      cached.timestamp = Date.now(); // Refresh timestamp
      this.metrics.cacheHits++;
      return cached.embedding;
    }

    // Generate new embedding
    const embedding = await this.embed(query);
    
    // Store in cache
    this.queryCache[query] = {
      embedding,
      timestamp: Date.now(),
      hitCount: 1
    };

    // Clean up cache if it's getting too large
    if (Object.keys(this.queryCache).length > this.MAX_CACHE_SIZE) {
      this.cleanupCache();
    }

    return embedding;
  }

  private calculateSemanticScore(tool: ToolWithEmb, queryEmbedding: number[]): number {
    if (!this.llmEnabled || queryEmbedding.length === 0 || tool.embedding.length === 0) {
      return 0;
    }
    return this.cosine(tool.embedding, queryEmbedding);
  }

  private calculateKeywordScore(tool: MCPTool, query: string): number {
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    let score = 0;

    queryWords.forEach(word => {
      const matchingTools = this.keywordIndex.get(word.toLowerCase()) || [];
      if (matchingTools.includes(tool)) {
        score += 1 / (matchingTools.length || 1);
      }
    });

    return Math.min(score / (queryWords.length || 1), 1.0);
  }

  private calculatePathScore(tool: MCPTool, query: string): number {
    const path = tool.endpoint?.path?.toLowerCase() || '';
    const queryWords = query.toLowerCase().split(/\s+/);
    
    let score = 0;
    queryWords.forEach(word => {
      if (word.length > 2 && path.includes(word)) {
        score += 0.5;
      }
    });

    return Math.min(score / (queryWords.length || 1), 1.0);
  }

  private async llmBasedSelection(message: string, candidates: ScoredTool[]): Promise<MatchResult | null> {
    if (!this.llmEnabled) return null;
    
    try {
      const functions = candidates.map(({ tool }) => ({
        name: tool.name,
        description: this.getToolDescription(tool),
        parameters: {
          type: 'object',
          properties: tool.inputSchema?.properties || {},
          required: tool.inputSchema?.required || []
        }
      }));

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an API assistant. Select the most appropriate tool for the user\'s request and extract parameters.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        functions,
        function_call: 'auto',
        temperature: 0.1
      });

      const functionCall = response.choices[0].message.function_call;
      if (!functionCall) return null;

      const matchedTool = candidates.find(c => c.tool.name === functionCall.name)?.tool;
      if (!matchedTool) return null;

      let parameters = {};
      try {
        parameters = JSON.parse(functionCall.arguments || '{}');
      } catch (e) {
        console.warn('Failed to parse LLM parameters:', e);
      }

      return {
        tool: matchedTool,
        parameters,
        confidence: 0.9,
        reasoning: 'Selected by LLM from embedding-filtered candidates'
      };

    } catch (error) {
      console.error('LLM selection failed:', error);
      return null;
    }
  }

  private createResultFromCandidate(candidate: ScoredTool): MatchResult {
    return {
      tool: candidate.tool,
      parameters: {},
      confidence: Math.min(candidate.score, 0.8),
      reasoning: `Best embedding match with score ${candidate.score.toFixed(2)}`
    };
  }

  private createFallbackResult(): MatchResult {
    return {
      tool: this.tools[0],
      parameters: {},
      confidence: 0.1,
      reasoning: 'No good matches found, using first available tool'
    };
  }

  private getToolDescription(tool: MCPTool): string {
    const parts = [
      tool.name,
      tool.description,
      tool.endpoint?.method && tool.endpoint?.path 
        ? `Endpoint: ${tool.endpoint.method} ${tool.endpoint.path}`
        : null,
      tool.inputSchema?.description
    ].filter(Boolean) as string[];

    return parts.join('\n') || 'No description available';
  }

  private async fallbackMatch(message: string): Promise<MatchResult | null> {
    if (!this.tools?.length) {
      throw new Error('No tools available for matching');
    }

    const messageLower = message.toLowerCase();
    const matchedTool = this.tools.find(tool => {
      if (!tool?.name) return false;
      
      const nameMatch = tool.name.toLowerCase().includes(messageLower);
      const descMatch = tool.description?.toLowerCase().includes(messageLower);
      const pathMatch = tool.endpoint?.path?.toLowerCase().includes(messageLower);
      
      return nameMatch || descMatch || pathMatch;
    }) || this.tools[0];

    return {
      tool: matchedTool,
      parameters: {},
      confidence: 0.3,
      reasoning: 'Fallback match using simple keyword search'
    };
  }

  /**
   * Generate a cURL command for the given tool and parameters
   */
  // generateCurlCommand(tool: MCPTool, parameters: Record<string, any> = {}): string {
  //   const { method, baseUrl, path } = tool.endpoint;
  //   let url = `${baseUrl}${path}`;

  //   // Replace path parameters e.g. /users/{id}
  //   for (const [key, value] of Object.entries(parameters)) {
  //     if (url.includes(`{${key}}`)) {
  //       url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
  //       delete parameters[key];
  //     }
  //   }

  //   // Query parameters
  //   const queryParams = new URLSearchParams();
  //   for (const [key, value] of Object.entries(parameters)) {
  //     if (value !== undefined && value !== null) {
  //       queryParams.append(key, String(value));
  //     }
  //   }
  //   const queryString = queryParams.toString();
  //   if (queryString) {
  //     url += (url.includes('?') ? '&' : '?') + queryString;
  //   }

  //   // Headers
  //   const headers: Record<string, any> = {
  //     'Content-Type': 'application/json',
  //     ...(parameters.headers || {})
  //   };

  //   // Build cURL string with line continuations for readability
  //   let curl = `curl -X ${method.toUpperCase()} "${url}"`;

  //   // Append headers with backslash-newline continuation
  //   for (const [key, value] of Object.entries(headers)) {
  //     if (value) {
  //       curl += ` \\\n  -H "${key}: ${value}"`;
  //     }
  //   }

  //   // Separate body parameters (for POST/PUT/PATCH)
  //   const bodyParams = { ...parameters } as Record<string, any>;
  //   delete bodyParams.headers;

  //   if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(bodyParams).length > 0) {
  //     curl += ` \\\n  -d '${JSON.stringify(bodyParams, null, 2)}'`;
  //   }

  //   return curl;
  // }
  generateCurlCommand(tool: MCPTool, parameters: Record<string, any> = {}): string {
    let { method, path, baseUrl } = tool.endpoint;
    let url = `${baseUrl}${path}`;
    
    // Make a copy of parameters to avoid mutating the original
    const params = { ...parameters };
    
    // Replace path parameters e.g. /users/{id}
    for (const [key, value] of Object.entries(params)) {
      if (url.includes(`{${key}}`)) {
        url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
        delete params[key];
      }
    }
  
    // Headers
    const headers: Record<string, any> = {
      'Content-Type': 'application/json',
      ...(params.headers || {})
    };
    
    // Remove headers from parameters
    delete params.headers;
  
    // Determine if we should use query params or body
    const isBodyRequest = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
    let bodyParams: Record<string, any> = {};
    let queryParams = new URLSearchParams();
  
    // For body requests, all remaining params go into the body
    if (isBodyRequest) {
      bodyParams = { ...params };  // Use all remaining params as the body
    } else {
      // For non-body requests, add all remaining params to query string
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      }
    }
    
    // Add query string if not empty
    const queryString = queryParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  
    // Build cURL string with line continuations for readability
    let curl = `curl -X ${method.toUpperCase()} "${url}"`;
  
    // Append headers with backslash-newline continuation
    for (const [key, value] of Object.entries(headers)) {
      if (value) {
        curl += ` \\\n  -H "${key}: ${value}"`;
      }
    }
  
    // Add body for POST/PUT/PATCH - Fixed formatting
    if (isBodyRequest && Object.keys(bodyParams).length > 0) {
      // Remove any 'body' wrapper if it exists
      const requestBody = bodyParams.body ? bodyParams.body : bodyParams;
      
      // Format the JSON body properly with indentation
      const jsonBody = JSON.stringify(requestBody, null, 2);
      // Split into lines and add proper indentation
      const bodyLines = jsonBody.split('\n');
      const formattedBody = bodyLines.map((line, index) => {
        if (index === 0) return line; // First line (opening brace)
        return `    ${line}`; // Indent subsequent lines
      }).join('\n');
      
      curl += ` \\\n  -d '${formattedBody}'`;
    }
  
    return curl;
  }
  
   /**
    * Return tools most similar to the query with their scores
   */
  async findSimilarTools(query: string, limit: number = 3): Promise<Array<{ tool: MCPTool; score: number }>> {
    if (!query?.trim()) return [];
    const candidates = await this.getTopCandidates(query, limit);
    return candidates.map(c => ({ tool: c.tool, score: c.score }));
  }

  async explainMatch(message: string): Promise<{
    bestMatch: MatchResult | null;
    allCandidates: ScoredTool[];
    explanation: string;
    cacheStats: any;
  }> {
    const candidates = await this.getTopCandidates(message, 10);
    const bestMatch = await this.findBestMatch(message);
    
    const explanation = candidates.length > 0 
      ? `Found ${candidates.length} potential matches. Top candidate scored ${candidates[0].score.toFixed(2)} using embeddings + hybrid scoring.`
      : 'No suitable tools found for the given query.';

    return {
      bestMatch,
      allCandidates: candidates,
      explanation,
      cacheStats: this.getCacheStats()
    };
  }

  /**
   * Cleanup method to call when shutting down
   */
  destroy(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.clearCache();
  }
}