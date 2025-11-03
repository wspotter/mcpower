import { Dataset } from '../types/dataset.js';
import { SearchResult, PythonBridgeResponse } from '../types/searchResult.js';
import { PythonBridgeRequest } from '../types/searchQuery.js';
import { pythonBridge } from '../bridge/pythonBridge.js';
import { logger } from '../logger.js';

/**
 * KnowledgeStore - Manages search operations for a single dataset
 * 
 * Provides high-level search interface with automatic retry logic,
 * error handling, and performance logging. Each instance is tied
 * to a specific dataset and its FAISS index.
 * 
 * Implements connection pooling and caching per Constitution III.
 * 
 * @example
 * ```typescript
 * const store = new KnowledgeStore(dataset);
 * const results = await store.search('my query', 5);
 * ```
 */
export class KnowledgeStore {
  private dataset: Dataset;

  /**
   * Creates a new KnowledgeStore instance for a dataset
   * 
   * @param dataset - Dataset configuration with index and metadata paths
   */
  constructor(dataset: Dataset) {
    this.dataset = dataset;
  }

  /**
   * Searches this dataset for documents matching the query
   * 
   * Uses FAISS vector similarity search with automatic retry logic
   * for transient failures. Logs performance metrics and errors.
   * 
   * @param query - Natural language search query
   * @param topK - Number of results to return (defaults to dataset's defaultTopK)
   * @returns Array of search results sorted by similarity score (descending)
   * @throws Error if search fails after retry attempt
   * 
   * @example
   * ```typescript
   * const results = await store.search('installation guide', 5);
   * results.forEach(r => console.log(`${r.title} (${r.score})`));
   * ```
   */
  async search(query: string, topK?: number): Promise<SearchResult[]> {
    const k = topK ?? this.dataset.defaultTopK;
    const startTime = Date.now();

    const request: PythonBridgeRequest = {
      command: 'search',
      indexPath: this.dataset.index,
      metadataPath: this.dataset.metadata,
      query,
      topK: k
    };

    try {
      // First attempt
      const response = await this.executeSearch(request);
      const duration = Date.now() - startTime;

      logger.info(
        {
          datasetId: this.dataset.id,
          query: query.substring(0, 100), // Truncate for logging
          resultCount: response.results.length,
          duration,
          pythonDuration: response.duration_ms
        },
        'Search completed successfully'
      );

      return response.results;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Retry once for transient failures
      logger.warn(
        {
          datasetId: this.dataset.id,
          error,
          duration
        },
        'Search failed, retrying once after 1s delay'
      );

      await this.delay(1000);

      try {
        const response = await this.executeSearch(request);
        const totalDuration = Date.now() - startTime;

        logger.info(
          {
            datasetId: this.dataset.id,
            query: query.substring(0, 100),
            resultCount: response.results.length,
            duration: totalDuration,
            pythonDuration: response.duration_ms,
            retried: true
          },
          'Search completed successfully after retry'
        );

        return response.results;
      } catch (retryError) {
        const totalDuration = Date.now() - startTime;

        logger.error(
          {
            datasetId: this.dataset.id,
            error: retryError,
            duration: totalDuration
          },
          'Search failed after retry'
        );

        throw new Error(
          `Search failed for dataset ${this.dataset.id}: ${retryError instanceof Error ? retryError.message : String(retryError)}`
        );
      }
    }
  }

  /**
   * Execute search via Python bridge
   */
  private async executeSearch(request: PythonBridgeRequest): Promise<PythonBridgeResponse> {
    return await pythonBridge.search(request);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get dataset information
   */
  getDataset(): Dataset {
    return this.dataset;
  }
}

/**
 * KnowledgeStoreCache - Singleton cache for KnowledgeStore instances
 * Implements per-dataset caching per Constitution III
 */
class KnowledgeStoreCache {
  private stores: Map<string, KnowledgeStore> = new Map();

  /**
   * Get or create a KnowledgeStore for a dataset
   */
  getStore(dataset: Dataset): KnowledgeStore {
    if (!this.stores.has(dataset.id)) {
      logger.debug({ datasetId: dataset.id }, 'Creating new KnowledgeStore instance');
      this.stores.set(dataset.id, new KnowledgeStore(dataset));
    }

    return this.stores.get(dataset.id)!;
  }

  /**
   * Clear the cache (for testing)
   */
  clear(): void {
    this.stores.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cachedStores: this.stores.size
    };
  }
}

/**
 * Singleton instance for store caching
 */
export const knowledgeStoreCache = new KnowledgeStoreCache();
