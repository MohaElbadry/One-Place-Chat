import express, { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { promises as fs } from 'fs';
import { fileTypeFromFile } from 'file-type';
import { MCPToolGenerator } from './src/utils/generator';
import type { MCPTool, MCPToolGenerationResult } from './src/types/mcp-tool.types.js';

// ========================
// Custom Logger
// ========================
const logger = {
  // Server lifecycle logs
  server: {
    info: (message: string) => console.log(`[SERVER] - ${message}`),
    error: (message: string, error?: Error) => 
      console.error(`[SERVER] ${new Date().toISOString()} - ❌ ${message}`, error || '')
  },
  
  // Tool generation logs
  toolGenerator: {
    info: (message: string) => console.log(`[TOOL-GEN] - ${message}`),
    success: (message: string) => console.log(`[TOOL-GEN] - ✅ ${message}`),
    error: (message: string, error?: Error) => 
      console.error(`[TOOL-GEN] ${new Date().toISOString()} - ❌ ${message}`, error || '')
  },
  
  // Request logging middleware
  request: (req: Request) => {
    console.log(`[REQ] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
};

// Configuration
const CONFIG = {
  PORT: 3000,
  OUTPUT_DIR: join(process.cwd(), 'generated-tools'),
  GENERATOR_CONFIG: {
    maxChunkSize: 10000,
    chunkOverlap: 500,
  },
  ALLOWED_MIME_TYPES: ['application/json', 'text/yaml', 'text/x-yaml'],
};



// Initialize Express app
const app = express();

// ========================
// Middleware
// ========================
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.request(req);
  next();
});

// Error handling middleware
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.server.error('Request failed', error);
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
  logger.toolGenerator.info(`Starting MCP tool generation for: ${filePath}`);
  
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
  logger.toolGenerator.success(`Generated ${tools.length} tools`);
  
  // Log each tool in development mode
  if (process.env.NODE_ENV === 'development') {
    tools.forEach((tool, index) => {
      logger.toolGenerator.info(`${index + 1}. ${tool.name} - ${tool.description || 'No description'}`);
    });
  }
  
  logger.toolGenerator.info(`Tools saved to: ${outputFile}`);
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
    logger.server.info(' One-Place-Chat Server');
    logger.server.info('======================');
    logger.server.info(`Server is running on http://localhost:${CONFIG.PORT}`);
    logger.server.info('\n Available endpoints:');
    logger.server.info(`- Health check:    http://localhost:${CONFIG.PORT}/health`);
    logger.server.info(`- Generate tools:  POST http://localhost:${CONFIG.PORT}/api/generate-tools`);
    logger.server.info('\n---- Server logs will appear below:\n');
  });

  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.server.error(`Port ${CONFIG.PORT} is already in use.`);
    } else {
      logger.server.error('Server error', error);
    }
    process.exit(1);
  });

  // Simple error handling for the server
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.server.error(`Port ${CONFIG.PORT} is already in use.`);
    } else {
      logger.server.error('Server error', error);
    }
    process.exit(1);
  });
}

// Start the MCP server
const startMCPServer = () => {
  logger.server.info('MCP Server functionality will be implemented here');
  // TODO: Implement MCP server functionality
  // This is a placeholder for the MCP server logic
  // For now, we just log that the MCP server has started
  logger.server.info('*****MCP Server started (placeholder)*******');
  return {
    close: () => {
      logger.server.info('MCP Server closed');
    }
  };
};

// Start the servers
let server: ReturnType<typeof app.listen>;
let mcpServer: ReturnType<typeof startMCPServer>;

async function startServers() {
  try {
    // Start the main server
    server = app.listen(CONFIG.PORT, () => {
      logger.server.info(' One-Place-Chat Server');
      logger.server.info('======================');
      logger.server.info(`Server is running on http://localhost:${CONFIG.PORT}`);
      logger.server.info('\n Available endpoints:');
      logger.server.info(`- Health check:    http://localhost:${CONFIG.PORT}/health`);
      logger.server.info(`- Generate tools:  POST http://localhost:${CONFIG.PORT}/api/generate-tools`);
      logger.server.info('\n---- Server logs will appear below:\n');
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.server.error(`Port ${CONFIG.PORT} is already in use.`);
      } else {
        logger.server.error('Server error', error);
      }
      process.exit(1);
    });
    
    // Start the MCP server
    mcpServer = startMCPServer();
    
    logger.server.info('All servers started successfully');
  } catch (error) {
    logger.server.error('Failed to start servers:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
function shutdown() {
  logger.server.info('Shutting down gracefully...');
  
  // Close the MCP server if it exists
  if (mcpServer) {
    mcpServer.close();
  }
  
  // Close the Express server if it exists
  if (server) {
    server.close(() => {
      logger.server.info('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

// Start all servers
startServers();


// Uncaught exceptions will cause the process to exit with an error code
process.on('uncaughtException', (error: unknown) => {
  const errorMessage = error instanceof Error ? error : new Error(String(error));
  console.error('Uncaught exception:', errorMessage);
  process.exit(1);
});
