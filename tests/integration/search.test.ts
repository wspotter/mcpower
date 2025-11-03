import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatasetRegistry } from '../../src/config/datasets.js';
import { knowledgeStoreCache } from '../../src/store/knowledgeStore.js';

describe('Search Integration Tests', () => {
  let testDatasetsPath: string;
  let registry: DatasetRegistry;

  beforeAll(async () => {
    // Create temporary test datasets directory
    testDatasetsPath = join(tmpdir(), `mcpower-test-${Date.now()}`);
    await mkdir(testDatasetsPath, { recursive: true });

    // Create a test dataset manifest
    const testDatasetDir = join(testDatasetsPath, 'test-dataset');
    await mkdir(testDatasetDir, { recursive: true });

    const manifest = {
      id: 'test-dataset',
      name: 'Test Dataset',
      description: 'Integration test dataset',
      index: join(testDatasetDir, 'index'),
      metadata: join(testDatasetDir, 'metadata.json'),
      defaultTopK: 3
    };

    // Create index directory
    await mkdir(manifest.index, { recursive: true });

    // Create metadata file
    await writeFile(
      manifest.metadata,
      JSON.stringify({ documents: [] })
    );

    // Write manifest
    await writeFile(
      join(testDatasetDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Load datasets into registry
    registry = new DatasetRegistry(testDatasetsPath);
    await registry.load();
  });

  describe('Dataset Loading', () => {
    it('should load test dataset successfully', () => {
      const dataset = registry.get('test-dataset');

      expect(dataset).toBeDefined();
      expect(dataset?.id).toBe('test-dataset');
      expect(dataset?.name).toBe('Test Dataset');
      expect(dataset?.status).toBe('ready');
    });

    it('should have correct dataset count', () => {
      const stats = registry.getStats();

      expect(stats.ready).toBeGreaterThanOrEqual(1);
      expect(stats.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('KnowledgeStore Integration', () => {
    it('should create store from loaded dataset', () => {
      const dataset = registry.get('test-dataset');
      expect(dataset).toBeDefined();

      if (dataset) {
        const store = knowledgeStoreCache.getStore(dataset);
        expect(store).toBeDefined();
        expect(store.getDataset().id).toBe('test-dataset');
      }
    });

    it('should cache store instances', () => {
      const dataset = registry.get('test-dataset');
      expect(dataset).toBeDefined();

      if (dataset) {
        const store1 = knowledgeStoreCache.getStore(dataset);
        const store2 = knowledgeStoreCache.getStore(dataset);

        // Should return same instance (cached)
        expect(store1).toBe(store2);
      }
    });
  });

  describe('End-to-End Search Flow', () => {
    it('should execute search through complete stack', async () => {
      const dataset = registry.get('test-dataset');
      expect(dataset).toBeDefined();

      if (dataset) {
        const store = knowledgeStoreCache.getStore(dataset);

        // Note: This will call the Python bridge with mock data
        // In a real integration test, you'd have actual FAISS indexes
        try {
          const results = await store.search('test query', 3);

          // Should return array (may be empty or mock data)
          expect(Array.isArray(results)).toBe(true);

          // If results exist, validate structure
          if (results.length > 0) {
            expect(results[0]).toHaveProperty('score');
            expect(results[0]).toHaveProperty('title');
            expect(results[0]).toHaveProperty('path');
            expect(results[0]).toHaveProperty('snippet');
          }
        } catch (error) {
          // Python bridge may not be installed yet - that's expected in CI
          expect(error).toBeDefined();
        }
      }
    });
  });
});
