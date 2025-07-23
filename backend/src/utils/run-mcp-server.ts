#!/usr/bin/env node
import { ApiMcpServer } from "../mcp/ApiMcpServer.js";
import { OpenAPIParser } from "./OpenAPIParser.js";
import type { ToolDefinition } from "../types/openapi.types.js";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROJECT_ROOT = path.join(__dirname, '../..');
const API_DOCS_DIR = path.join(PROJECT_ROOT, 'api-docs');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'generated-tools');

// Default API spec path
const DEFAULT_SPEC = path.join(API_DOCS_DIR, 'Petstore/swagger.json');

// Ensure output directory exists
if (!fsSync.existsSync(OUTPUT_DIR)) {
  fsSync.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export async function generateTools(
  specPath: string = DEFAULT_SPEC
): Promise<{ tools: ToolDefinition[]; outputPath: string }> {
  // Ensure the spec file exists
  if (!fsSync.existsSync(specPath)) {
    throw new Error(`API spec not found at: ${specPath}`);
  }
  
  try {
    console.log(`🔧 Loading OpenAPI specification from: ${specPath}`);

    // Read and parse the spec file
    const specContent = await fs.readFile(specPath, "utf-8");
    const spec = JSON.parse(specContent);

    console.log("🔄 Parsing OpenAPI specification...");
    const parser = new OpenAPIParser(spec);
    const tools = parser.parseOperations();

    // Generate timestamp for the output file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const specName = path.basename(specPath, path.extname(specPath));
    const outputFilename = `${specName}-tools-${timestamp}.json`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    // Save the generated tools for inspection
    await fs.writeFile(outputPath, JSON.stringify(tools, null, 2));

    console.log(`✅ Generated ${tools.length} tools. Saved to: ${outputPath}`);
    return { tools, outputPath };
  } catch (error) {
    console.error("❌ Failed to generate tools:", error);
    throw error;
  }
}

async function startMcpServer(tools: ToolDefinition[]) {
  try {
    console.log("🚀 Starting MCP server...");
    const server = new ApiMcpServer();
    server.registerTools(tools);
    await server.start();
    console.log("🎉 MCP Server is running. Ready to accept connections.");
  } catch (error) {
    console.error("❌ Failed to start MCP server:", error);
    throw error;
  }
}

async function main() {
  try {
    // Generate tools with default spec
    const githubSpecPath = path.join(process.cwd(), 'api-docs/TMDB/openAPI.json');
    const { tools, outputPath } = await generateTools(githubSpecPath);

    console.log(`🚀 Starting MCP server with tools from: ${outputPath}`);

    // Start the MCP server with the generated tools
    await startMcpServer(tools);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n🛑 Shutting down MCP server...");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Check if this file is being run directly
const isMainModule = import.meta.url.endsWith(process.argv[1]);
if (isMainModule) {
  main().catch(console.error);
}
