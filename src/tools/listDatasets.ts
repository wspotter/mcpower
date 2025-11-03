import { z } from 'zod';
import { getDatasetRegistry } from '../server.js';
import { logger } from '../logger.js';

/**
 * knowledge.listDatasets MCP Tool Implementation
 * 
 * Phase 4: User Story 2 - Dataset Discovery (T029)
 * 
 * Returns list of available datasets with metadata, statistics,
 * and optional error information for diagnostics.
 */

/**
 * Input schema for knowledge.listDatasets tool
 * 
 * Validates tool arguments using Zod schema.
 */
export const ListDatasetsArgsSchema = z
  .object({
    /** Include datasets that failed to load (for diagnostics) */
    includeErrors: z.boolean().optional().default(false),
  })
  .strict();

type ListDatasetsArgs = z.infer<typeof ListDatasetsArgsSchema>;

/**
 * Dataset list response item structure
 */
interface DatasetListItem {
  /** Unique dataset identifier */
  id: string;
  /** Human-readable dataset name */
  name: string;
  /** Dataset description */
  description: string;
  /** Dataset status (ready for use or error) */
  status: 'ready' | 'error';
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Handles the knowledge.listDatasets MCP tool invocation
 * 
 * Retrieves all registered datasets from the registry, formats them
 * for display, and returns comprehensive metadata including counts
 * and optional error details.
 * 
 * @param args - Tool arguments (validated against ListDatasetsArgsSchema)
 * @returns MCP tool response with dataset list and metadata
 * 
 * @example
 * ```typescript
 * const response = await handleListDatasets({
 *   includeErrors: true
 * });
 * ```
 */
export async function handleListDatasets(
  args: unknown
): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  const startTime = Date.now();
  
  try {
    // Validate arguments
    const parseResult = ListDatasetsArgsSchema.safeParse(args);
    if (!parseResult.success) {
      logger.warn(
        { errors: parseResult.error.errors, args },
        'Invalid arguments for knowledge.listDatasets'
      );
      return {
        content: [
          {
            type: 'text',
            text: `Invalid arguments: ${parseResult.error.errors
              .map((e) => `${e.path.join('.')}: ${e.message}`)
              .join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    const { includeErrors } = parseResult.data;

    logger.info({ includeErrors }, 'Listing datasets');

    // Get dataset registry
    const registry = getDatasetRegistry();

    // Get ready datasets
    const readyDatasets = registry.listReady();
    const results: DatasetListItem[] = readyDatasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      description: dataset.description || '',
      status: 'ready' as const,
    }));

    // Optionally include datasets with errors
    if (includeErrors) {
      const errors = registry.getErrors();
      for (const error of errors) {
        // Extract dataset ID from manifest path (e.g., /path/to/datasets/my-dataset/manifest.json -> my-dataset)
        const pathParts = error.manifestPath.split('/');
        const datasetId = pathParts[pathParts.length - 2] || 'unknown';
        
        results.push({
          id: datasetId,
          name: datasetId, // Use ID as name fallback
          description: 'Failed to load dataset',
          status: 'error' as const,
          error: error.error,
        });
      }
    }

    // Calculate statistics
    const totalCount = results.length;
    const readyCount = results.filter((d) => d.status === 'ready').length;
    const errorCount = results.filter((d) => d.status === 'error').length;

    // Format response text
    let responseText = `Found ${totalCount} dataset${totalCount !== 1 ? 's' : ''}`;
    if (includeErrors && errorCount > 0) {
      responseText += ` (${readyCount} ready, ${errorCount} with errors)`;
    }
    responseText += ':\n\n';

    // Add dataset details
    for (const dataset of results.sort((a, b) => a.id.localeCompare(b.id))) {
      responseText += `**${dataset.id}**\n`;
      responseText += `  Name: ${dataset.name}\n`;
      responseText += `  Description: ${dataset.description}\n`;
      responseText += `  Status: ${dataset.status}\n`;
      if (dataset.error) {
        responseText += `  Error: ${dataset.error}\n`;
      }
      responseText += '\n';
    }

    // Add summary footer
    const duration = Date.now() - startTime;
    responseText += `---\n`;
    responseText += `Total: ${totalCount} datasets | Ready: ${readyCount}`;
    if (includeErrors && errorCount > 0) {
      responseText += ` | Errors: ${errorCount}`;
    }
    responseText += ` | Retrieved in ${duration}ms`;

    logger.info(
      {
        totalCount,
        readyCount,
        errorCount,
        duration,
      },
      'Listed datasets successfully'
    );

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        duration,
      },
      'Failed to list datasets'
    );

    return {
      content: [
        {
          type: 'text',
          text: `Error listing datasets: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      ],
      isError: true,
    };
  }
}
