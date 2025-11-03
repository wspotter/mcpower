import { SearchQuerySchema, SearchQuery } from '../types/searchQuery.js';
import { SearchResult } from '../types/searchResult.js';
import { getDatasetRegistry } from '../server.js';
import { knowledgeStoreCache } from '../store/knowledgeStore.js';
import { logger } from '../logger.js';

/**
 * Error codes for knowledge.search tool
 * 
 * Standard error codes returned when search operations fail.
 */
export const SearchErrorCodes = {
  /** Dataset ID not found in registry or not ready */
  DATASET_NOT_FOUND: 'DATASET_NOT_FOUND',
  /** Query string is empty or invalid */
  INVALID_QUERY: 'INVALID_QUERY',
  /** topK parameter is out of valid range (1-100) */
  INVALID_TOP_K: 'INVALID_TOP_K',
  /** Python bridge or FAISS service unavailable */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const;

/**
 * Handles the knowledge.search MCP tool invocation
 * 
 * Validates input parameters, retrieves the dataset, performs semantic
 * search using FAISS, and returns formatted results. Implements comprehensive
 * error handling and logging.
 * 
 * @param args - Tool arguments (validated against SearchQuerySchema)
 * @returns MCP tool response with search results or error message
 * 
 * @example
 * ```typescript
 * const response = await handleSearch({
 *   dataset: 'my-docs',
 *   query: 'installation guide',
 *   topK: 5
 * });
 * ```
 */
export async function handleSearch(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  const startTime = Date.now();

  try {
    // Validate input with Zod
    const validationResult = SearchQuerySchema.safeParse(args);

    if (!validationResult.success) {
      const error = validationResult.error.issues[0];
      logger.warn(
        { args, error: error.message, path: error.path },
        'Search validation failed'
      );

      return {
        content: [{
          type: 'text',
          text: `Invalid search parameters: ${error.message} at ${error.path.join('.')}`
        }],
        isError: true
      };
    }

    const query: SearchQuery = validationResult.data;

    // Get dataset from registry
    const registry = getDatasetRegistry();
    const dataset = registry.get(query.dataset);

    if (!dataset || dataset.status !== 'ready') {
      const availableDatasets = registry.listReady().map(d => d.id);

      logger.warn(
        { datasetId: query.dataset, availableDatasets },
        'Dataset not found or not ready'
      );

      return {
        content: [{
          type: 'text',
          text: `Dataset '${query.dataset}' not found. Available datasets: ${availableDatasets.join(', ')}`
        }],
        isError: true
      };
    }

    // Get or create KnowledgeStore for this dataset
    const store = knowledgeStoreCache.getStore(dataset);

    // Execute search
    logger.info(
      {
        datasetId: query.dataset,
        query: query.query.substring(0, 100), // Truncate for logging
        topK: query.topK ?? dataset.defaultTopK
      },
      'Executing search'
    );

    const results: SearchResult[] = await store.search(query.query, query.topK);
    const duration = Date.now() - startTime;

    // Log successful search
    logger.info(
      {
        datasetId: query.dataset,
        query: query.query.substring(0, 100),
        resultCount: results.length,
        duration
      },
      'Search completed'
    );

    // Format response
    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No results found for query: "${query.query}" in dataset "${query.dataset}"`
        }]
      };
    }

    // Format results as text
    const resultText = results.map((result, index) => {
      return `${index + 1}. ${result.title} (score: ${result.score.toFixed(4)})
   Path: ${result.path}
   Snippet: ${result.snippet.substring(0, 200)}${result.snippet.length > 200 ? '...' : ''}
`;
    }).join('\n');

    const summary = `Found ${results.length} result${results.length === 1 ? '' : 's'} for "${query.query}" in ${duration}ms:\n\n${resultText}`;

    return {
      content: [{
        type: 'text',
        text: summary
      }]
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      {
        error: errorMessage,
        args,
        duration
      },
      'Search failed'
    );

    return {
      content: [{
        type: 'text',
        text: `Search failed: ${errorMessage}`
      }],
      isError: true
    };
  }
}
