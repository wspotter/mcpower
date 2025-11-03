import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { json } from 'express';
import { resolve, join } from 'path';
import { readFile } from 'fs/promises';
import { DatasetRegistry } from '../config/datasets.js';
import { createDataset } from '../datasets/createDataset.js';
import { deleteDataset } from '../datasets/deleteDataset.js';
import { logger } from '../logger.js';

const DATASETS_PATH = process.env.MCPOWER_DATASETS ?? './datasets';
const PORT = Number(process.env.MCPOWER_WEB_PORT ?? 4173);
const HOST = process.env.MCPOWER_WEB_HOST ?? '127.0.0.1';
const STATIC_DIR = resolve('./webapp');

function ensureStaticAssets(app: express.Express): void {
  app.use(express.static(STATIC_DIR));
  // SPA fallback for direct navigation
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(join(STATIC_DIR, 'index.html'));
  });
}

type DatasetSummary = {
  id: string;
  name: string;
  description: string;
  status: string;
  defaultTopK: number;
  metadataPath: string;
  indexPath: string;
  documentCount?: number;
  chunkCount?: number;
  model?: string;
  updatedAt?: string;
};

async function loadDatasetSummaries(): Promise<DatasetSummary[]> {
  const registry = new DatasetRegistry(DATASETS_PATH);
  await registry.load();
  const datasets = registry.list();

  const summaries = await Promise.all(datasets.map(async dataset => {
    const summary: DatasetSummary = {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      status: dataset.status,
      defaultTopK: dataset.defaultTopK,
      metadataPath: dataset.metadata,
      indexPath: dataset.index
    };

    try {
      const metadataContent = await readFile(dataset.metadata, 'utf-8');
      const metadataJson = JSON.parse(metadataContent);

      if (Array.isArray(metadataJson)) {
        summary.documentCount = metadataJson.length;
      } else if (metadataJson && typeof metadataJson === 'object') {
        if (Array.isArray(metadataJson.documents)) {
          summary.documentCount = metadataJson.documents.length;
        }
        if (Array.isArray(metadataJson.documents)) {
          const chunkTotal = metadataJson.documents.reduce((acc: number, doc: any) => acc + (doc.chunk_total ?? 1), 0);
          summary.chunkCount = chunkTotal;
        }
        if (typeof metadataJson.model === 'string') {
          summary.model = metadataJson.model;
        }
        if (metadataJson.stats && typeof metadataJson.stats === 'object') {
          if (typeof metadataJson.stats.totalChunks === 'number') {
            summary.chunkCount = metadataJson.stats.totalChunks;
          }
          if (typeof metadataJson.stats.indexedAt === 'string') {
            summary.updatedAt = metadataJson.stats.indexedAt;
          }
          if (typeof metadataJson.stats.totalDocuments === 'number') {
            summary.documentCount = metadataJson.stats.totalDocuments;
          }
        }
      }
    } catch (error) {
      logger.warn({ datasetId: dataset.id, error }, 'Failed to parse dataset metadata');
    }

    return summary;
  }));

  return summaries;
}

async function bootstrap(): Promise<void> {
  const app = express();
  app.use(cors());
  app.use(json({ limit: '10mb' }));

  app.get('/api/datasets', async (_req, res) => {
    try {
      const datasets = await loadDatasetSummaries();
      res.json({ datasets });
    } catch (error) {
      logger.error({ error }, 'Failed to list datasets');
      res.status(500).json({ error: 'Failed to list datasets' });
    }
  });

  app.post('/api/datasets', async (req, res) => {
    try {
      const { sourcePath, datasetId, name, description, model, chunkSize, chunkOverlap } = req.body ?? {};

      if (!sourcePath || !datasetId || !name) {
        res.status(400).json({ error: 'sourcePath, datasetId, and name are required' });
        return;
      }

      const result = await createDataset({
        sourcePath,
        datasetId,
        name,
        description,
        model,
        chunkSize,
        chunkOverlap,
        datasetsPath: DATASETS_PATH
      });

      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Dataset creation request failed');
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/datasets/:id', async (req, res) => {
    try {
      await deleteDataset(req.params.id, DATASETS_PATH);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ datasetId: req.params.id, error: message }, 'Dataset deletion failed');
      res.status(400).json({ error: message });
    }
  });

  ensureStaticAssets(app);

  app.listen(PORT, HOST, () => {
    logger.info({ port: PORT, host: HOST, datasetsPath: DATASETS_PATH }, 'MCPower Web console started');
  });
}

bootstrap().catch(error => {
  logger.error({ error }, 'Failed to start web server');
  process.exit(1);
});
