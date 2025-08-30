import { Router } from 'express';
import { ChromaDBToolLoader } from '../../tools/ChromaDBToolLoader.js';
import { ChromaDBService } from '../../database/ChromaDBService.js';
import { OpenApiToolParser } from '../../parsers/OpenApiToolParser.js';
import OpenAI from 'openai';
import { ChromaClient } from 'chromadb';
import multer from 'multer';

const router = Router();
const chromaService = new ChromaDBService();
const toolLoader = new ChromaDBToolLoader();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

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

// GET /api/tools/health - Get current tool status and health
router.get('/health', async (req, res) => {
  try {
    await ensureInitialized();
    
    // Always load fresh tools from ChromaDB to get the latest state
    await toolLoader.loadTools();
    const tools = toolLoader.getTools();
    
    res.json({
      success: true,
      status: 'healthy',
      tools: {
        count: tools.length,
        loaded: tools.length > 0,
        lastRefresh: new Date().toISOString()
      },
      collections: {
        generated_tools: 'available',
        conversations: 'available',
        messages: 'available'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking tools health:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Failed to check tools health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/tools - Get all available tools
router.get('/', async (req, res) => {
  try {
    await ensureInitialized();
    
    // Always load fresh tools from ChromaDB to get the latest state
    await toolLoader.loadTools();
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
    
    // Always load fresh tools from ChromaDB before searching
    await toolLoader.loadTools();
    
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
      count: tools.length,
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

// POST /api/tools/refresh - Force refresh tools from ChromaDB
router.post('/refresh', async (req, res) => {
  try {
    console.log('🔄 Force refreshing tools from ChromaDB...');
    
    // Reset the initialization flag to force reload
    isInitialized = false;
    
    // Re-initialize and reload tools
    await ensureInitialized();
    
    const tools = toolLoader.getTools();
    
    console.log(`✅ Refreshed ${tools.length} tools from ChromaDB`);
    
    res.json({
      success: true,
      message: `Successfully refreshed ${tools.length} tools from ChromaDB`,
      count: tools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh tools',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/tools/force-refresh - Force complete refresh and reinitialize
router.post('/force-refresh', async (req, res) => {
  try {
    console.log('🔄 Force complete refresh and reinitialization...');
    
    // Reset the initialization flag
    isInitialized = false;
    
    // Clear the tool loader cache
    await toolLoader.loadTools();
    
    // Re-initialize everything
    await ensureInitialized();
    
    const tools = toolLoader.getTools();
    
    console.log(`✅ Force refreshed ${tools.length} tools from ChromaDB`);
    
    res.json({
      success: true,
      message: `Successfully force refreshed ${tools.length} tools from ChromaDB`,
      count: tools.length,
      timestamp: new Date().toISOString(),
      action: 'force_refresh_completed'
    });
  } catch (error) {
    console.error('Error force refreshing tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force refresh tools',
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

// POST /api/tools/upload - Upload JSON file and generate tools
router.post('/upload', upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please upload a JSON file'
      });
    }

    // Check if OpenAI API key is available
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(400).json({
        success: false,
        error: 'OpenAI API key not configured',
        message: 'OPENAI_API_KEY environment variable is required for tool generation'
      });
    }

    await ensureInitialized();

    // Parse the uploaded JSON file
    let spec;
    try {
      const fileContent = req.file.buffer.toString('utf-8');
      spec = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON file',
        message: 'The uploaded file is not a valid JSON file'
      });
    }

    // Validate that it's an OpenAPI specification
    if (!spec.openapi && !spec.swagger) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OpenAPI specification',
        message: 'The uploaded file must be a valid OpenAPI/Swagger specification'
      });
    }

    console.log(`📖 Processing OpenAPI specification: ${spec.info?.title || 'Unknown API'}`);

    // Parse tools from the specification
    const parser = new OpenApiToolParser(spec);
    const tools = parser.parseOperations();
    
    if (tools.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tools generated',
        message: 'No valid API operations found in the specification'
      });
    }

    console.log(`🔧 Generated ${tools.length} tools from uploaded specification`);

    // Initialize OpenAI and ChromaDB for embeddings
    const openai = new OpenAI({ apiKey: openaiKey });
    const chromaClient = new ChromaClient({ 
      host: process.env.CHROMADB_HOST || 'localhost',
      port: parseInt(process.env.CHROMADB_PORT || '8000')
    });

    // Test ChromaDB connection
    await chromaClient.heartbeat();
    console.log('✅ ChromaDB connection successful');

    // Create or get ChromaDB collection
    const toolsCollection = await chromaClient.getOrCreateCollection({
      name: 'generated_tools',
      metadata: { 
        description: `Tools generated from ${spec.info?.title || 'Uploaded OpenAPI spec'}`,
        source: req.file.originalname,
        generatedAt: new Date().toISOString(),
        uploadedBy: 'API'
      }
    });

    // Clear existing tools from this source to prevent duplicates
    console.log('🧹 Clearing existing tools from this source...');
    await toolsCollection.delete({
      where: { source: req.file.originalname }
    });
    console.log('✅ Existing tools cleared');

    // Generate embeddings and store tools
    let toolIds: string[] = [];
    let toolEmbeddings: number[][] = [];
    let toolMetadatas: any[] = [];
    let toolDocuments: string[] = [];

    console.log('🧠 Generating embeddings and storing in ChromaDB...');

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      
      // Create text representation for embedding
      const toolText = [
        tool.name || 'unnamed',
        tool.description || '',
        tool.annotations?.method || '',
        tool.annotations?.path || '',
        (tool.annotations?.tags || []).join(' ')
      ].filter(Boolean).join(' ');
      
      console.log(`   Generating embedding for: ${tool.name || `tool_${i + 1}`}`);
      
      try {
        // Generate embedding using OpenAI
        const response = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: toolText
        });
        
        const embedding = response.data[0].embedding;
        
        const toolId = `tool_${Date.now()}_${i}`;
        toolIds.push(toolId);
        toolEmbeddings.push(embedding);
        toolMetadatas.push({
          name: tool.name || `tool_${i + 1}`,
          description: tool.description || 'No description',
          method: tool.annotations?.method || 'UNKNOWN',
          path: tool.annotations?.path || 'No path',
          tags: (tool.annotations?.tags || []).join(','),
          createdAt: new Date().toISOString(),
          source: req.file.originalname,
          uploadedBy: 'API'
        });
        toolDocuments.push(JSON.stringify(tool));
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if ((i + 1) % 10 === 0) {
          console.log(`   📊 Processed ${i + 1}/${tools.length} tools`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to generate embedding for tool ${i + 1}:`, error);
        // Continue with other tools
      }
    }

    // Store in ChromaDB
    if (toolIds.length > 0) {
      console.log(`📦 Storing ${toolIds.length} tools in ChromaDB...`);
      await toolsCollection.add({
        ids: toolIds,
        embeddings: toolEmbeddings,
        metadatas: toolMetadatas,
        documents: toolDocuments
      });
      console.log('✅ Tools stored in ChromaDB successfully');
      
      // Get collection stats
      const stats = await toolsCollection.count();
      console.log(`📊 Total tools in ChromaDB: ${stats}`);
    }

    // Refresh the tool loader to include new tools
    await toolLoader.loadTools();

    res.status(201).json({
      success: true,
      data: {
        message: 'Tools generated and stored successfully',
        toolsGenerated: toolIds.length,
        specification: {
          title: spec.info?.title || 'Unknown API',
          version: spec.info?.version || 'Unknown',
          description: spec.info?.description || 'No description'
        },
        source: req.file.originalname,
        uploadedAt: new Date().toISOString(),
        chromaDBStats: {
          totalTools: await toolLoader.getToolCount(),
          collectionName: 'generated_tools'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating tools from uploaded file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tools',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

export { router as toolsRouter };
