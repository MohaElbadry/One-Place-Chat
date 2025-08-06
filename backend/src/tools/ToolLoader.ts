import { promises as fs } from 'fs';
import path from 'path';
import { MCPTool } from '../types.js';

export class ToolLoader {
  private tools: MCPTool[] = [];
  private loaded = false;

  async loadTools(toolsDir: string): Promise<MCPTool[]> {
    if (this.loaded) return this.tools;
    
    try {
      const files = await fs.readdir(toolsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(toolsDir, file), 'utf-8');
          const tool = JSON.parse(content);
          this.tools.push(tool);
        } catch (error) {
          console.error(`Error loading tool from ${file}:`, error);
        }
      }
      
      this.loaded = true;
      console.log(`Loaded ${this.tools.length} tools from ${toolsDir}`);
      return this.tools;
    } catch (error) {
      console.error('Error loading tools:', error);
      throw error;
    }
  }

  getTools(): MCPTool[] {
    return [...this.tools];
  }

  getTool(name: string): MCPTool | undefined {
    return this.tools.find(tool => tool.name === name);
  }

  searchTools(query: string): MCPTool[] {
    const lowerQuery = query.toLowerCase();
    return this.tools.filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      (tool.description && tool.description.toLowerCase().includes(lowerQuery)) ||
      tool.endpoint.path.toLowerCase().includes(lowerQuery)
    );
  }
}
