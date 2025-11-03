import { z } from 'zod';

/**
 * Search Result Schema
 * Defines the structure for individual search results from FAISS queries
 */
export const SearchResultSchema = z.object({
  score: z.number().min(0).max(1).describe('Similarity/relevance score from FAISS (higher = more relevant)'),
  title: z.string().min(1).max(256).describe('Document title or heading'),
  path: z.string().min(1).max(512).describe('Document path or URL for citation/attribution'),
  snippet: z.string().max(2048).describe('Text excerpt from matched document content')
});

/**
 * Search Result entity type inferred from Zod schema
 */
export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Python Bridge Response structure
 * Returned from Python bridge subprocess containing search results and metadata
 */
export interface PythonBridgeResponse {
  results: SearchResult[];
  duration_ms: number;
  dataset_size: number;
}
