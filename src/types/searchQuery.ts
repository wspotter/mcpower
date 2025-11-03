import { z } from 'zod';

/**
 * Search Query Schema (MCP tool input)
 * Defines the structure for knowledge.search tool input validation
 */
export const SearchQuerySchema = z.object({
  dataset: z.string().min(1).max(64).describe('Dataset ID to search (must be a registered dataset)'),
  query: z.string().trim().min(1).max(1024).describe('Natural language search query'),
  topK: z.number().int().min(1).max(100).optional().describe('Number of results to return (defaults to dataset\'s defaultTopK)')
});

/**
 * Search Query entity type inferred from Zod schema
 */
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * Python Bridge Request structure
 * Internal request structure passed to Python bridge subprocess
 */
export interface PythonBridgeRequest {
  command: 'search' | 'validate-index' | 'health-check';
  indexPath: string;
  query?: string;
  topK?: number;
}
