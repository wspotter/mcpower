import { rm, access } from 'fs/promises';
import { constants } from 'fs';
import { resolve, join } from 'path';
import { logger } from '../logger.js';

const DATASET_ID_REGEX = /^[a-z0-9-]+$/;

/**
 * Delete a dataset directory from the datasets path.
 */
export async function deleteDataset(datasetId: string, datasetsPath: string = './datasets'): Promise<void> {
  if (!DATASET_ID_REGEX.test(datasetId)) {
    throw new Error('Dataset ID must be lowercase alphanumeric with hyphens only');
  }

  const basePath = resolve(datasetsPath);
  const datasetDir = resolve(join(basePath, datasetId));

  if (!datasetDir.startsWith(basePath)) {
    throw new Error('Dataset path resolves outside of datasets directory');
  }

  try {
    await access(datasetDir, constants.F_OK);
  } catch {
    throw new Error(`Dataset '${datasetId}' does not exist`);
  }

  logger.info({ datasetId, datasetDir }, 'Deleting dataset');
  await rm(datasetDir, { recursive: true, force: true });
  logger.info({ datasetId }, 'Dataset deleted');
}
