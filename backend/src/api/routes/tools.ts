import { Router } from 'express';
import { ChromaDBToolLoader } from '../../tools/ChromaDBToolLoader.js';
import { ChromaDBService } from '../../database/ChromaDBService.js';

const router = Router();
const chromaService = new ChromaDBService();
const toolLoader = new ChromaDBToolLoader();

// Initialize services
let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    try {
      await chromaService.initialize();
      await toolLoader.loadTools();
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw new Error('Services not available');
    }
  }
}

// GET /api/tools - Get all available tools
router.get('/', async (req, res) => {
  try {
    await ensureInitialized();
    
    const tools = toolLoader.getTools();
    
    res.json({
      success: true,
      data: tools.map(tool => ({
        id: tool.name,
        name: tool.name,
        description: tool.description,
        method: tool.annotations.method,
        path: tool.annotations.path,
        tags: tool.annotations.tags || [],
        deprecated: tool.annotations.deprecated,
        title: tool.annotations.title,
        readOnly: tool.annotations.readOnlyHint,
        openWorld: tool.annotations.openWorldHint
      })),
      count: tools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tools',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/tools/search - Search tools by query
router.get('/search', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    await ensureInitialized();
    
    const searchLimit = Math.min(parseInt(limit as string) || 10, 50);
    const tools = await toolLoader.searchTools(query, searchLimit);
    
    res.json({
      success: true,
      data: tools.map(tool => ({
        id: tool.name,
        name: tool.name,
        description: tool.description,
        method: tool.annotations.method,
        path: tool.annotations.path,
        tags: tool.annotations.tags || [],
        deprecated: tool.annotations.deprecated,
        title: tool.annotations.title,
        readOnly: tool.annotations.readOnlyHint,
        openWorld: tool.annotations.openWorldHint
      })),
      query,
      count: tools.length,
      limit: searchLimit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error searching tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search tools',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/tools/stats - Get tools statistics
router.get('/stats', async (req, res) => {
  try {
    await ensureInitialized();
    
    const totalTools = toolLoader.getToolCount();
    const isLoaded = toolLoader.isLoaded();
    
    res.json({
      success: true,
      data: {
        totalTools,
        isLoaded,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching tools stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tools statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/tools/categories/:category - Get tools by category
router.get('/categories/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 20 } = req.query;
    
    await ensureInitialized();
    
    const searchLimit = Math.min(parseInt(limit as string) || 20, 100);
    const tools = await toolLoader.getToolsByCategory(category);
    
    res.json({
      success: true,
      data: tools.slice(0, searchLimit).map(tool => ({
        id: tool.name,
        name: tool.name,
        description: tool.description,
        method: tool.annotations.method,
        path: tool.annotations.path,
        tags: tool.annotations.tags || [],
        deprecated: tool.annotations.deprecated,
        title: tool.annotations.title,
        readOnly: tool.annotations.readOnlyHint,
        openWorld: tool.annotations.openWorldHint
      })),
      category,
      count: tools.length,
      limit: searchLimit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tools by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tools by category',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/tools/:id - Get specific tool by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await ensureInitialized();
    
    const tool = toolLoader.getTool(id);
    
    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'Tool not found',
        message: `Tool with ID "${id}" not found`
      });
    }
    
    res.json({
      success: true,
      data: {
        id: tool.name,
        name: tool.name,
        description: tool.description,
        method: tool.annotations.method,
        path: tool.annotations.path,
        tags: tool.annotations.tags || [],
        deprecated: tool.annotations.deprecated,
        title: tool.annotations.title,
        readOnly: tool.annotations.readOnlyHint,
        openWorld: tool.annotations.openWorldHint,
        inputSchema: tool.inputSchema,
        endpoint: tool.endpoint,
        security: tool.security
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tool',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as toolsRouter };
