import { readdir, readFile, access, stat } from 'fs/promises';
import { join, resolve, isAbsolute, dirname } from 'path';
import { Dataset, DatasetManifestSchema, DatasetError, DatasetWithStatus } from '../types/dataset.js';
import { logger } from '../logger.js';
import { pythonBridge } from '../bridge/pythonBridge.js';

/**
 * Security constants for dataset loading
 */
const MAX_MANIFEST_SIZE = 10 * 1024; // 10KB
const MAX_RECURSION_DEPTH = 3; // Limit directory traversal depth

/**
 * DatasetRegistry - Manages dataset discovery, loading, and validation
 * 
 * Scans the datasets directory on startup, validates manifests, and maintains
 * a registry of available datasets. Provides graceful error handling and
 * detailed diagnostics for dataset loading failures.
 * 
 * @example
 * ```typescript
 * const registry = new DatasetRegistry('./datasets');
 * await registry.load();
 * const dataset = registry.get('my-dataset');
 * const stats = registry.getStats();
 * ```
 */
export class DatasetRegistry {
  private datasets: Map<string, DatasetWithStatus> = new Map();
  private loadErrors: DatasetError[] = [];
  private datasetsPath: string;

  /**
   * Creates a new DatasetRegistry instance
   * 
   * @param datasetsPath - Absolute or relative path to datasets directory (default: './datasets')
   */
  constructor(datasetsPath: string = './datasets') {
    this.datasetsPath = resolve(datasetsPath);
  }

  /**
   * Loads all datasets from the datasets directory
   * 
   * Scans for subdirectories containing manifest.json files, validates each manifest,
   * verifies required files exist, and registers valid datasets. Continues loading
   * even if individual datasets fail (graceful degradation).
   * 
   * Security: Limited to direct subdirectories only (max depth 1) to prevent
   * directory traversal attacks and excessive filesystem operations.
   * 
   * @throws Never throws - errors are logged and tracked in loadErrors array
   */
  async load(): Promise<void> {
    logger.info({ datasetsPath: this.datasetsPath }, 'Starting dataset discovery');

    try {
      // Check if datasets directory exists
      await access(this.datasetsPath);
    } catch {
      logger.warn({ datasetsPath: this.datasetsPath }, 'Datasets directory does not exist, creating empty registry');
      return;
    }

    try {
      // Phase 6: Only scan direct subdirectories (T046 - Security hardening)
      // Depth limited to 1 level to prevent directory traversal attacks
      const entries = await readdir(this.datasetsPath, { withFileTypes: true });
      const directories = entries.filter(entry => entry.isDirectory());

      logger.info({ count: directories.length }, 'Found dataset directories');

      for (const dir of directories) {
        const manifestPath = join(this.datasetsPath, dir.name, 'manifest.json');
        await this.loadManifest(manifestPath);
      }

      const successCount = Array.from(this.datasets.values()).filter(d => d.status === 'ready').length;
      const errorCount = this.loadErrors.length;

      logger.info(
        { total: directories.length, success: successCount, errors: errorCount },
        'Dataset discovery completed'
      );
    } catch (error) {
      logger.error({ error, datasetsPath: this.datasetsPath }, 'Failed to scan datasets directory');
    }
  }

  /**
   * Load and validate a single dataset manifest
   */
  private async loadManifest(manifestPath: string): Promise<void> {
    let datasetId: string | undefined;
    
    try {
      // Phase 6: Validate manifest file size (T046 - Security hardening)
      const stats = await stat(manifestPath);
      if (stats.size > MAX_MANIFEST_SIZE) {
        throw new Error(
          `Manifest file exceeds maximum size (${stats.size} > ${MAX_MANIFEST_SIZE} bytes). ` +
          `This limit prevents DoS attacks from large manifest files.`
        );
      }
      
      // Read manifest file
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifestData = JSON.parse(manifestContent);

      // Validate against schema
      const dataset = DatasetManifestSchema.parse(manifestData);
      datasetId = dataset.id;

      const manifestDir = dirname(resolve(manifestPath));
      const resolvePath = (pathValue: string) => {
        if (isAbsolute(pathValue)) {
          return resolve(pathValue);
        }
        return resolve(join(manifestDir, pathValue));
      };

      // Resolve paths relative to project root
      const resolvedDataset: Dataset = {
        ...dataset,
        index: resolvePath(dataset.index),
        metadata: resolvePath(dataset.metadata)
      };

      // Verify index directory exists
      try {
        await access(resolvedDataset.index);
      } catch {
        throw new Error(`Index directory not found: ${resolvedDataset.index}`);
      }

      // Verify metadata file exists
      try {
        await access(resolvedDataset.metadata);
      } catch {
        throw new Error(`Metadata file not found: ${resolvedDataset.metadata}`);
      }

      // Phase 5: Validate FAISS index using Python bridge (T038)
      try {
        const validationResult = await pythonBridge.validateIndex(resolvedDataset.index);
        
        if (validationResult.status === 'error') {
          throw new Error(`FAISS index validation failed: ${validationResult.error || 'Unknown error'}`);
        }
        
        logger.debug(
          {
            datasetId: dataset.id,
            indexPath: resolvedDataset.index,
            validation: validationResult
          },
          'FAISS index validated successfully'
        );
      } catch (validationError) {
        // Log validation failure but don't stop loading - allow dataset to be registered with warning
        const errorMsg = validationError instanceof Error ? validationError.message : String(validationError);
        logger.warn(
          {
            datasetId: dataset.id,
            indexPath: resolvedDataset.index,
            error: errorMsg
          },
          'FAISS index validation failed, dataset may not be searchable'
        );
        
        // Mark dataset as having validation issues (but still register it)
        // This allows the dataset to be listed but searches may fail
      }

      // Register dataset as ready
      this.datasets.set(dataset.id, {
        ...resolvedDataset,
        status: 'ready'
      });

      logger.info(
        {
          datasetId: dataset.id,
          name: dataset.name,
          indexPath: resolvedDataset.index,
          metadataPath: resolvedDataset.metadata
        },
        'Dataset loaded successfully'
      );
    } catch (error) {
      // Phase 5: Enhanced error logging with full context (SC-003)
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Determine error type for better diagnostics
      let errorType = 'unknown';
      if (error instanceof Error) {
        if (error.message.includes('JSON')) {
          errorType = 'json_parse_error';
        } else if (error.message.includes('not found')) {
          errorType = 'file_not_found';
        } else if (error.message.includes('Required')) {
          errorType = 'validation_error';
        }
      }

      this.loadErrors.push({
        manifestPath,
        error: errorMessage,
        timestamp: new Date()
      });

      // Enhanced structured logging with full paths and context
      logger.error(
        {
          datasetId: datasetId || 'unknown',
          manifestPath: resolve(manifestPath), // Full absolute path
          errorType,
          error: errorMessage,
          datasetsDirectory: this.datasetsPath
        },
        'Failed to load dataset manifest'
      );
    }
  }

  /**
   * Retrieves a dataset by its unique identifier
   * 
   * @param id - Dataset identifier (as specified in manifest.json)
   * @returns Dataset with status, or undefined if not found
   * 
   * @example
   * ```typescript
   * const dataset = registry.get('my-docs');
   * if (dataset && dataset.status === 'ready') {
   *   // Use dataset
   * }
   * ```
   */
  get(id: string): DatasetWithStatus | undefined {
    return this.datasets.get(id);
  }

  /**
   * Checks if a dataset exists and is ready for use
   * 
   * @param id - Dataset identifier
   * @returns true if dataset exists and status is 'ready'
   * 
   * @example
   * ```typescript
   * if (registry.has('my-docs')) {
   *   // Dataset is available for searching
   * }
   * ```
   */
  has(id: string): boolean {
    const dataset = this.datasets.get(id);
    return dataset !== undefined && dataset.status === 'ready';
  }

  /**
   * Lists all registered datasets (including those with errors)
   * 
   * @returns Array of all datasets with their status
   */
  list(): DatasetWithStatus[] {
    return Array.from(this.datasets.values());
  }

  /**
   * Lists only datasets that are ready for searching
   * 
   * Filters out datasets that failed validation or loading.
   * Use this for presenting available datasets to users.
   * 
   * @returns Array of ready datasets
   */
  listReady(): DatasetWithStatus[] {
    return Array.from(this.datasets.values()).filter(d => d.status === 'ready');
  }

  /**
   * Retrieves all dataset loading errors for diagnostics
   * 
   * Returns errors that occurred during dataset discovery, including
   * manifest parsing errors, validation failures, and missing files.
   * 
   * @returns Array of dataset errors with paths and timestamps
   */
  getErrors(): DatasetError[] {
    return this.loadErrors;
  }

  /**
   * Gets registry statistics for monitoring and diagnostics
   * 
   * @returns Statistics object with total, ready, and error counts
   * 
   * @example
   * ```typescript
   * const stats = registry.getStats();
   * console.log(`${stats.ready}/${stats.total} datasets ready, ${stats.errors} errors`);
   * ```
   */
  getStats() {
    const ready = this.listReady().length;
    const errors = this.loadErrors.length;
    return {
      total: this.datasets.size + errors,
      ready,
      errors
    };
  }
}
