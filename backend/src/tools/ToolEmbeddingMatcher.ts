import { MCPTool, MatchResult, ScoredTool } from '../types.js';
import OpenAI from 'openai';

type ToolWithEmb = MCPTool & { 
  embedding: number[];
  embeddingHash?: string; // For cache validation
};

// In-memory cache for query embeddings
interface QueryCache {
  [query: string]: {
    embedding: number[];
    timestamp: number;
    hitCount: number;
  };
}

/**
 * Advanced tool matcher using embeddings for semantic similarity.
 * Provides embedding-based matching with caching and performance optimization.
 */
export class ToolEmbeddingMatcher {
  private openai!: OpenAI;
  protected tools: ToolWithEmb[] = [];
  private llmEnabled: boolean = true;
  protected isInitialized: boolean = false;
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

    // console.log(`Generating embeddings for ${filtered.length} tools...`);
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
            return existingTool;
          }

          // Generate new embedding (silent)
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

  protected async embed(text: string): Promise<number[]> {
    if (!this.llmEnabled) {
      // Return a simple hash-based embedding for fallback
      const hash = text.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return Array.from({ length: 1536 }, (_, i) => Math.sin(hash + i) * 0.1);
    }

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

  protected detectIntent(query: string): 'create'|'read'|'update'|'delete'|'other' {
    const lowerQuery = query.toLowerCase();
    
    if (/\b(get|fetch|retrieve|find|search|list|show|display|read)\b/.test(lowerQuery)) return 'read';
    if (/\b(create|add|insert|post|new|make)\b/.test(lowerQuery)) return 'create';
    if (/\b(update|modify|change|edit|patch|put)\b/.test(lowerQuery)) return 'update';
    if (/\b(delete|remove|destroy|clear)\b/.test(lowerQuery)) return 'delete';
    
    return 'other';
  }

  protected calculateIntentScore(tool: MCPTool, intent: string): number {
    const method = tool.endpoint?.method?.toUpperCase() || '';
    
    switch (intent) {
      case 'read': return ['GET', 'HEAD'].includes(method) ? 1.0 : 0.0;
      case 'create': return ['POST', 'PUT'].includes(method) ? 1.0 : 0.0;
      case 'update': return ['PUT', 'PATCH'].includes(method) ? 1.0 : 0.0;
      case 'delete': return method === 'DELETE' ? 1.0 : 0.0;
      default: return 0.5;
    }
  }

  protected cosine(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na  += a[i] * a[i];
      nb  += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  }

  private createFallbackResult(): MatchResult {
    return {
      tool: this.tools[0],
      parameters: {},
      confidence: 0.1,
      reasoning: 'No good matches found, using first available tool'
    };
  }



 
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
   * Cleanup method to call when shutting down
   */
  destroy(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.clearCache();
  }
}