import express, { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { promises as fs } from 'fs';
import { fileTypeFromFile } from 'file-type';
import { MCPToolGenerator } from './src/utils/generator/mcp-tool-generator.js';
import type { MCPTool, MCPToolGenerationResult } from './src/types/mcp-tool.types.js';

// Configuration
const CONFIG = {
  PORT: 3000,
  OUTPUT_DIR: join(process.cwd(), 'generated-tools'),
  ALLOWED_MIME_TYPES: ['application/json', 'text/yaml', 'text/x-yaml'],
  GENERATOR_CONFIG: {
    maxChunkSize: 10000,
    chunkOverlap: 500
  }
};

// Initialize Express app
const app = express();

// ========================
// Middleware
// ========================
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ========================
// API Routes
// ========================

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Generate MCP tools from OpenAPI specification
 * POST /api/generate-tools
 * Body: { filePath: string }
 */
app.post('/api/generate-tools', async (req: Request, res: Response) => {
  const { filePath } = req.body;
  
  // Input validation
  if (!filePath) {
    return res.status(400).json({ 
      success: false, 
      error: 'filePath is required in the request body' 
    });
  }

  try {
    // Ensure output directory exists
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
    
    // File validation
    await validateFile(filePath);
    
    // Generate tools
    const { tools, outputFile } = await generateTools(filePath);
    
    // Send success response
    res.json({
      success: true,
      message: 'Tools generated successfully',
      outputFile,
      tools: tools.map(formatTool),
      metadata: {
        totalTools: tools.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    throw error; // Will be caught by error handling middleware
  }
});

// ========================
// Helper Functions
// ========================

/**
 * Validates the input file
 */
async function validateFile(filePath: string): Promise<void> {
  // Check if file exists
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  // Check file type
  const fileType = await fileTypeFromFile(filePath);
  if (fileType?.mime && !CONFIG.ALLOWED_MIME_TYPES.includes(fileType.mime)) {
    throw new Error('Invalid file type. Only JSON and YAML files are supported.');
  }
}

/**
 * Generates tools from an OpenAPI specification
 */
async function generateTools(filePath: string): Promise<{ tools: MCPTool[], outputFile: string }> {
  console.log(`\n🔧 Starting MCP tool generation for: ${filePath}`);
  
  const generator = new MCPToolGenerator(CONFIG.GENERATOR_CONFIG);
  const result = await generator.generateMCPTools(filePath);
  
  // Save the generated tools
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = join(CONFIG.OUTPUT_DIR, `mcp-tools-${timestamp}.json`);
  
  await fs.writeFile(outputFile, JSON.stringify(result, null, 2), 'utf-8');
  
  // Log results
  logGeneratedTools(result.tools, outputFile);
  
  return { tools: result.tools, outputFile };
}

/**
 * Logs the generated tools to console
 */
function logGeneratedTools(tools: MCPTool[], outputFile: string): void {
  console.log('\n✅ Successfully generated tools:');
  tools.forEach((tool, index) => {
    console.log(`  ${index + 1}. ${tool.name} - ${tool.description || 'No description'}`);
  });
  console.log(`\n📝 Tools saved to: ${outputFile}`);
}

/**
 * Formats a tool for the API response
 */
function formatTool(tool: MCPTool) {
  return {
    name: tool.name,
    description: tool.description,
    inputParameters: Object.keys(tool.inputSchema?.properties || {})
  };
}

// ========================
// Server Initialization
// ========================

function startServer() {
  const server = app.listen(CONFIG.PORT, () => {
    console.log('\n🚀 One-Place-Chat Server');
    console.log('======================');
    console.log(`✅ Server is running on http://localhost:${CONFIG.PORT}`);
    console.log('\n📡 Available endpoints:');
    console.log(`- Health check:    http://localhost:${CONFIG.PORT}/health`);
    console.log(`- Generate tools:  POST http://localhost:${CONFIG.PORT}/api/generate-tools`);
    console.log('\n📝 Server logs will appear below:\n');
  });

  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${CONFIG.PORT} is already in use.`);
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🔽 Shutting down server...');
    server.close(() => {
      console.log('✅ Server has been terminated');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('\n❌ Uncaught Exception:', error);
    server.close(() => process.exit(1));
  });
}

// Start the server
startServer();
