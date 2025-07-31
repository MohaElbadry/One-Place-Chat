import { AdvancedAPIToolMatcher } from './advanced-api-tool-matcher.js';
import { MCPTool } from '../types.js';

/**
 * Thin compatibility wrapper to maintain legacy imports (`APIToolMatcher`, `HTTPBinToolMatcher`).
 * All functionality now resides in `AdvancedAPIToolMatcher`.
 */
export class APIToolMatcher extends AdvancedAPIToolMatcher {
  private _initialized = false;
  constructor(apiKey?: string) {
    super(apiKey ?? process.env.OPENAI_API_KEY);
  }

  /**
   * Backwards-compatible wrapper which allows passing tools array directly.
   */
  async findBestMatch(message: string, tools?: MCPTool[]) {
    if (tools && !this._initialized) {
      await this.initialize(tools);
      this._initialized = true;
    }
    return super.findBestMatch(message);
  }

  async findSimilarTools(query: string, limit = 3, tools?: MCPTool[]) {
    if (tools && !this._initialized) {
      await this.initialize(tools);
      this._initialized = true;
    }
    return super.findSimilarTools(query, limit);
  }
}

// Stub matcher for HTTPBin examples – currently identical to `APIToolMatcher`.
export class HTTPBinToolMatcher extends APIToolMatcher {}

export default APIToolMatcher;
