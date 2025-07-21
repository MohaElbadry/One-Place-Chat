import { MCPTool } from '../../../types/mcp-tool.types';

/**
 * Optimizes MCP tools by removing duplicates and cleaning up schemas
 */
export class ToolOptimizer {
  /**
   * Optimizes a list of MCP tools
   */
  public optimizeTools(tools: MCPTool[]): MCPTool[] {
    return this.removeDuplicateTools(tools).map((tool) =>
      this.optimizeToolSchema(tool)
    );
  }

  /**
   * Removes duplicate tools by name
   */
  private removeDuplicateTools(tools: MCPTool[]): MCPTool[] {
    const seen = new Set<string>();
    return tools.filter((tool) => {
      if (seen.has(tool.name)) {
        return false;
      }
      seen.add(tool.name);
      return true;
    });
  }

  /**
   * Optimizes a single tool's schema
   */
  private optimizeToolSchema(tool: MCPTool): MCPTool {
    const optimized = { ...tool };

    if (optimized.inputSchema.required?.length === 0) {
      delete optimized.inputSchema.required;
    }

    return optimized;
  }
}
