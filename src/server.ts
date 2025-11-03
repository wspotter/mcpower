import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { DatasetRegistry } from './config/datasets.js';
import { logger } from './logger.js';
import { handleSearch } from './tools/search.js';
import { handleListDatasets } from './tools/listDatasets.js';

/**
 * Server configuration options
 */
export interface ServerConfig {
  transport: 'stdio';
  datasetsPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Global dataset registry instance
 */
let datasetRegistry: DatasetRegistry;

/**
 * Get server version from package.json
 */
async function getServerVersion(): Promise<string> {
  try {
    const packagePath = resolve('./package.json');
    const packageContent = await readFile(packagePath, 'utf-8');
    const packageData = JSON.parse(packageContent);
    return packageData.version || '0.1.0';
  } catch {
    // Fallback if package.json can't be read
    return '0.1.0';
  }
}

/**
 * Start the MCP server
 */
export async function startServer(config: ServerConfig): Promise<void> {
  const startTime = Date.now();
  const serverVersion = await getServerVersion();

  // Phase 5: Enhanced startup logging (FR-015)
  logger.info(
    {
      version: serverVersion,
      transport: config.transport,
      datasetsPath: config.datasetsPath,
      logLevel: config.logLevel,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    },
    'Starting MCP Knowledge Server'
  );

  // Initialize dataset registry
  datasetRegistry = new DatasetRegistry(config.datasetsPath);
  await datasetRegistry.load();

  const stats = datasetRegistry.getStats();
  const loadErrors = datasetRegistry.getErrors();

  // Phase 5: Enhanced startup diagnostics with operational status (FR-015)
  logger.info(
    {
      total: stats.total,
      ready: stats.ready,
      errors: stats.errors,
      startupDuration: Date.now() - startTime,
      status: 'ready'
    },
    'Dataset registry initialized - server ready'
  );

  // Log any dataset loading errors
  if (loadErrors.length > 0) {
    for (const error of loadErrors) {
      logger.error(
        {
          manifestPath: error.manifestPath,
          error: error.error,
          timestamp: error.timestamp
        },
        'Dataset failed to load'
      );
    }
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'mcpower',
      version: serverVersion
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'knowledge.search',
          description: 'Search a knowledge dataset for relevant documents using semantic similarity',
          inputSchema: {
            type: 'object',
            properties: {
              dataset: {
                type: 'string',
                description: 'Dataset ID to search (must be a registered dataset)'
              },
              query: {
                type: 'string',
                description: 'Natural language search query'
              },
              topK: {
                type: 'number',
                description: 'Number of results to return (defaults to dataset\'s defaultTopK)'
              }
            },
            required: ['dataset', 'query']
          }
        },
        {
          name: 'knowledge.listDatasets',
          description: 'List all registered knowledge datasets available for searching',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    };
  });

    // Register tool request handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    logger.info({ tool: name, args }, 'Tool invocation received');
    
    try {
      switch (name) {
        case 'knowledge.search':
          return await handleSearch(args);
          
        case 'knowledge.listDatasets':
          return await handleListDatasets(args);
          
        default:
          logger.warn({ tool: name }, 'Unknown tool requested');
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      logger.error({ tool: name, error }, 'Tool execution failed');
      return {
        content: [
          {
            type: 'text',
            text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const totalDuration = Date.now() - startTime;

  logger.info(
    {
      status: 'ready',
      duration: totalDuration,
      readyDatasets: stats.ready
    },
    'MCP server ready'
  );
}

/**
 * Get the dataset registry instance (for use by tools)
 */
export function getDatasetRegistry(): DatasetRegistry {
  if (!datasetRegistry) {
    throw new Error('Dataset registry not initialized');
  }
  return datasetRegistry;
}
