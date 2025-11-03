import { resolve } from 'path';
import { execa } from 'execa';
import { logger } from '../logger.js';

export interface CreateDatasetOptions {
  sourcePath: string;
  datasetId: string;
  name: string;
  description?: string;
  datasetsPath?: string;
  model?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface CreateDatasetResult {
  datasetId: string;
  documents: number;
  chunks: number;
  model: string;
  embeddingDimensions: number;
  indexPath: string;
  metadataPath: string;
}

const DATASET_ID_REGEX = /^[a-z0-9-]+$/;

/**
 * Create a dataset by invoking the Python indexer.
 */
export async function createDataset(options: CreateDatasetOptions): Promise<CreateDatasetResult> {
  if (!DATASET_ID_REGEX.test(options.datasetId)) {
    throw new Error('Dataset ID must be lowercase alphanumeric with hyphens only');
  }

  if (!options.name || options.name.trim().length === 0) {
    throw new Error('Dataset name is required');
  }

  const pythonScript = resolve('./python/indexer.py');
  const pythonExecutable = process.env.MCPOWER_PYTHON || 'python3';
  const args = [
    pythonScript,
    'index',
    '--source', resolve(options.sourcePath),
    '--dataset-id', options.datasetId,
    '--output', resolve(options.datasetsPath ?? './datasets'),
    '--name', options.name
  ];

  if (options.description) {
    args.push('--description', options.description);
  }

  if (options.model) {
    args.push('--model', options.model);
  }

  if (options.chunkSize) {
    args.push('--chunk-size', String(options.chunkSize));
  }

  if (options.chunkOverlap) {
    args.push('--chunk-overlap', String(options.chunkOverlap));
  }

  logger.info({ datasetId: options.datasetId, sourcePath: options.sourcePath }, 'Starting dataset creation');

  const result = await execa(pythonExecutable, args, {
    reject: false,
    encoding: 'utf8'
  });

  if (result.exitCode !== 0) {
    const message = result.stderr || result.stdout || 'Unknown dataset creation failure';
    logger.error({ exitCode: result.exitCode, message }, 'Dataset creation failed');
    throw new Error(message.trim());
  }

  try {
    const payload = JSON.parse(result.stdout) as CreateDatasetResult;
    logger.info({ datasetId: payload.datasetId, documents: payload.documents }, 'Dataset created successfully');
    return payload;
  } catch (error) {
    logger.error({ error, stdout: result.stdout }, 'Failed to parse dataset creation response');
    throw new Error('Dataset creation succeeded but returned invalid JSON');
  }
}
