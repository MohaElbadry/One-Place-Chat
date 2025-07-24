import { DocumentLoaderImpl } from './loaders/document-loader';
import { DocumentValidator } from './validators/document-validator';
import { DocumentChunker } from './chunkers/document-chunker';
import { EndpointProcessor } from './processors/endpoint-processor';
import { ToolGenerator } from './generators/tool-generator';
import { ToolOptimizer } from './optimizers/tool-optimizer';
import type { 
  MCPToolGenerationResult,
  MCPTool 
} from './types/mcp-tool.types';
import type { 
  DocumentProcessorOptions,
  EndpointInfo,
  HttpMethod 
} from './types/document.types';

/**
 * MCP (Machine-Readable API Client) Tool Generator
 * 
 * This is the main class that orchestrates the generation of MCP tools
 * from API specifications. It handles the entire pipeline from loading
 * and validating the API spec to generating and optimizing the tools.
 */
export class MCPToolGenerator {
  private readonly documentLoader: DocumentLoaderImpl;
  private readonly documentValidator: DocumentValidator;
  private readonly documentChunker: DocumentChunker;
  private readonly endpointProcessor: EndpointProcessor;
  private readonly toolGenerator: ToolGenerator;
  private readonly toolOptimizer: ToolOptimizer;

  constructor(options: DocumentProcessorOptions = {}) {
    this.documentLoader = new DocumentLoaderImpl();
    this.documentValidator = new DocumentValidator();
    this.documentChunker = new DocumentChunker(
      options.maxChunkSize,
      options.chunkOverlap
    );
    this.endpointProcessor = new EndpointProcessor();
    this.toolGenerator = new ToolGenerator();
    this.toolOptimizer = new ToolOptimizer();
  }

  /**
   * Generates MCP tools from an API specification document
   * 
   * @returns Promise that resolves to the generated tools and metadata
   */
  public async generateMCPTools(
    documentPath: string
  ): Promise<MCPToolGenerationResult> {
    const startTime = Date.now();

    try {
      // 1. Load the document
      const document = await this.documentLoader.load(documentPath);

      // 2. Validate the document
      const { isValid, errors } = this.documentValidator.validate(document);
      if (!isValid) {
        throw new Error(`Invalid API document: ${errors.join(', ')}`);
      }

      // 3. Chunk the document for processing
      const chunks = this.documentChunker.chunk(document);

      // 4. Process each chunk to extract endpoints
      const endpoints = chunks.flatMap((chunk) =>
        this.endpointProcessor.processChunk(chunk, document)
      );

      // 5. Generate tools from endpoints
      const tools = this.toolGenerator.generateToolsFromEndpoints(endpoints, document);

      // 6. Optimize the generated tools
      const optimizedTools = this.toolOptimizer.optimizeTools(tools);

      // 7. Return the results with metadata
      return {
        tools: optimizedTools,
        metadata: {
          totalEndpoints: endpoints.length,
          processedChunks: chunks.length,
          apiInfo: {
            title: document.info?.title,
            version: document.info?.version,
            description: document.info?.description,
          },
          processingTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to generate MCP tools: ${error.message}`);
    }
  }
}

// Re-export types for convenience
export * from './types/document.types';
export * from '../types/mcp-tool.types';
