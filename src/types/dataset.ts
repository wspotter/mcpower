import { z } from 'zod';

/**
 * Dataset/Manifest Schema
 * Defines the structure for dataset registration via JSON manifest files
 */
export const DatasetManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).min(1).max(64).describe('Unique dataset identifier (lowercase alphanumeric with hyphens)'),
  name: z.string().min(1).max(128).describe('Human-readable dataset name for display'),
  description: z.string().min(1).max(512).describe('Brief description of dataset contents and purpose'),
  index: z.string().min(1).describe('Absolute or relative path to FAISS index directory'),
  metadata: z.string().min(1).describe('Absolute or relative path to metadata JSON file'),
  defaultTopK: z.number().int().min(1).max(100).default(5).describe('Default number of results to return for searches')
});

/**
 * Dataset entity type inferred from Zod schema
 */
export type Dataset = z.infer<typeof DatasetManifestSchema>;

/**
 * Alias for Dataset - represents the physical manifest file
 */
export type DatasetManifest = Dataset;

/**
 * Dataset error information for diagnostics
 */
export interface DatasetError {
  manifestPath: string;
  error: string;
  timestamp: Date;
}

/**
 * Dataset status for runtime state tracking
 */
export type DatasetStatus = 'unloaded' | 'validating' | 'invalid' | 'loading' | 'ready' | 'error';

/**
 * Dataset with runtime status information
 */
export interface DatasetWithStatus extends Dataset {
  status: DatasetStatus;
  error?: string;
}
