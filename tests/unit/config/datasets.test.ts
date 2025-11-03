import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatasetRegistry } from '../../../src/config/datasets.js';

/**
 * Unit tests for DatasetRegistry
 * 
 * Phase 5: User Story 3 - Server Health Monitoring (T033)
 * Testing manifest validation and error handling
 */

describe('DatasetRegistry', () => {
  let testDatasetsPath: string;
  let registry: DatasetRegistry;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDatasetsPath = join(tmpdir(), `mcpower-datasets-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDatasetsPath, { recursive: true });
    registry = new DatasetRegistry(testDatasetsPath);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDatasetsPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Valid manifests', () => {
    it('should load a valid manifest successfully', async () => {
      // Create a valid dataset
      const datasetDir = join(testDatasetsPath, 'valid-dataset');
      await fs.mkdir(datasetDir, { recursive: true });

      const indexPath = join(datasetDir, 'index');
      const metadataPath = join(datasetDir, 'metadata.json');

      await fs.mkdir(indexPath, { recursive: true });
      await fs.writeFile(metadataPath, '{}');

      const manifest = {
        id: 'valid-dataset',
        name: 'Valid Dataset',
        description: 'A valid test dataset',
        index: indexPath,
        metadata: metadataPath,
        defaultTopK: 5
      };

      await fs.writeFile(
        join(datasetDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      await registry.load();

      const dataset = registry.get('valid-dataset');
      expect(dataset).toBeDefined();
      expect(dataset?.status).toBe('ready');
      expect(dataset?.name).toBe('Valid Dataset');
      expect(dataset?.defaultTopK).toBe(5);
    });

    it('should load multiple valid datasets', async () => {
      // Create first dataset
      const dataset1Dir = join(testDatasetsPath, 'dataset-1');
      await fs.mkdir(dataset1Dir, { recursive: true });
      const index1 = join(dataset1Dir, 'index');
      const metadata1 = join(dataset1Dir, 'metadata.json');
      await fs.mkdir(index1, { recursive: true });
      await fs.writeFile(metadata1, '{}');
      await fs.writeFile(
        join(dataset1Dir, 'manifest.json'),
        JSON.stringify({
          id: 'dataset-1',
          name: 'Dataset 1',
          description: 'First dataset',
          index: index1,
          metadata: metadata1,
          defaultTopK: 5
        })
      );

      // Create second dataset
      const dataset2Dir = join(testDatasetsPath, 'dataset-2');
      await fs.mkdir(dataset2Dir, { recursive: true });
      const index2 = join(dataset2Dir, 'index');
      const metadata2 = join(dataset2Dir, 'metadata.json');
      await fs.mkdir(index2, { recursive: true });
      await fs.writeFile(metadata2, '{}');
      await fs.writeFile(
        join(dataset2Dir, 'manifest.json'),
        JSON.stringify({
          id: 'dataset-2',
          name: 'Dataset 2',
          description: 'Second dataset',
          index: index2,
          metadata: metadata2,
          defaultTopK: 3
        })
      );

      await registry.load();

      expect(registry.list()).toHaveLength(2);
      expect(registry.listReady()).toHaveLength(2);
      expect(registry.has('dataset-1')).toBe(true);
      expect(registry.has('dataset-2')).toBe(true);
    });
  });

  describe('Invalid manifests', () => {
    it('should log error for manifest with missing required fields', async () => {
      const datasetDir = join(testDatasetsPath, 'invalid-dataset');
      await fs.mkdir(datasetDir, { recursive: true });

      // Missing 'id' and 'description' fields
      const invalidManifest = {
        name: 'Invalid Dataset',
        index: './index',
        metadata: './metadata.json'
      };

      await fs.writeFile(
        join(datasetDir, 'manifest.json'),
        JSON.stringify(invalidManifest)
      );

      await registry.load();

      const errors = registry.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Required');
      expect(errors[0].manifestPath).toContain('invalid-dataset');
    });

    it('should log error for invalid JSON', async () => {
      const datasetDir = join(testDatasetsPath, 'broken-json');
      await fs.mkdir(datasetDir, { recursive: true });

      await fs.writeFile(
        join(datasetDir, 'manifest.json'),
        '{ invalid json }'
      );

      await registry.load();

      const errors = registry.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].manifestPath).toContain('broken-json');
    });

    it('should log error for missing index directory', async () => {
      const datasetDir = join(testDatasetsPath, 'missing-index');
      await fs.mkdir(datasetDir, { recursive: true });

      const indexPath = join(datasetDir, 'nonexistent-index');
      const metadataPath = join(datasetDir, 'metadata.json');
      await fs.writeFile(metadataPath, '{}');

      const manifest = {
        id: 'missing-index',
        name: 'Missing Index Dataset',
        description: 'Dataset with missing index',
        index: indexPath,
        metadata: metadataPath,
        defaultTopK: 5
      };

      await fs.writeFile(
        join(datasetDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      await registry.load();

      const errors = registry.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Index directory not found');
      expect(errors[0].error).toContain(indexPath);
    });

    it('should log error for missing metadata file', async () => {
      const datasetDir = join(testDatasetsPath, 'missing-metadata');
      await fs.mkdir(datasetDir, { recursive: true });

      const indexPath = join(datasetDir, 'index');
      const metadataPath = join(datasetDir, 'nonexistent-metadata.json');
      await fs.mkdir(indexPath, { recursive: true });

      const manifest = {
        id: 'missing-metadata',
        name: 'Missing Metadata Dataset',
        description: 'Dataset with missing metadata',
        index: indexPath,
        metadata: metadataPath,
        defaultTopK: 5
      };

      await fs.writeFile(
        join(datasetDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      await registry.load();

      const errors = registry.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Metadata file not found');
      expect(errors[0].error).toContain(metadataPath);
    });
  });

  describe('Error recovery', () => {
    it('should continue loading remaining datasets after error', async () => {
      // Create invalid dataset
      const invalidDir = join(testDatasetsPath, 'invalid');
      await fs.mkdir(invalidDir, { recursive: true });
      await fs.writeFile(
        join(invalidDir, 'manifest.json'),
        JSON.stringify({ name: 'Missing ID' }) // Invalid: no id field
      );

      // Create valid dataset
      const validDir = join(testDatasetsPath, 'valid');
      await fs.mkdir(validDir, { recursive: true });
      const indexPath = join(validDir, 'index');
      const metadataPath = join(validDir, 'metadata.json');
      await fs.mkdir(indexPath, { recursive: true });
      await fs.writeFile(metadataPath, '{}');
      await fs.writeFile(
        join(validDir, 'manifest.json'),
        JSON.stringify({
          id: 'valid',
          name: 'Valid Dataset',
          description: 'This one should load',
          index: indexPath,
          metadata: metadataPath,
          defaultTopK: 5
        })
      );

      await registry.load();

      // Valid dataset should be loaded
      expect(registry.has('valid')).toBe(true);
      expect(registry.listReady()).toHaveLength(1);

      // Invalid dataset should be in errors
      expect(registry.getErrors()).toHaveLength(1);

      // Stats should reflect both
      const stats = registry.getStats();
      expect(stats.ready).toBe(1);
      expect(stats.errors).toBe(1);
      expect(stats.total).toBe(2);
    });

    it('should handle nonexistent datasets directory gracefully', async () => {
      const nonexistentPath = join(tmpdir(), `nonexistent-${Date.now()}`);
      const emptyRegistry = new DatasetRegistry(nonexistentPath);

      await emptyRegistry.load();

      expect(emptyRegistry.list()).toHaveLength(0);
      expect(emptyRegistry.getErrors()).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should report accurate statistics', async () => {
      // Create 2 valid datasets
      for (let i = 1; i <= 2; i++) {
        const dir = join(testDatasetsPath, `dataset-${i}`);
        await fs.mkdir(dir, { recursive: true });
        const indexPath = join(dir, 'index');
        const metadataPath = join(dir, 'metadata.json');
        await fs.mkdir(indexPath, { recursive: true });
        await fs.writeFile(metadataPath, '{}');
        await fs.writeFile(
          join(dir, 'manifest.json'),
          JSON.stringify({
            id: `dataset-${i}`,
            name: `Dataset ${i}`,
            description: `Test dataset ${i}`,
            index: indexPath,
            metadata: metadataPath,
            defaultTopK: 5
          })
        );
      }

      // Create 1 invalid dataset
      const invalidDir = join(testDatasetsPath, 'invalid');
      await fs.mkdir(invalidDir, { recursive: true });
      await fs.writeFile(
        join(invalidDir, 'manifest.json'),
        JSON.stringify({ name: 'No ID' })
      );

      await registry.load();

      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.ready).toBe(2);
      expect(stats.errors).toBe(1);
    });
  });

  describe('Error details', () => {
    it('should include timestamp in error records', async () => {
      const datasetDir = join(testDatasetsPath, 'invalid');
      await fs.mkdir(datasetDir, { recursive: true });
      await fs.writeFile(
        join(datasetDir, 'manifest.json'),
        JSON.stringify({ name: 'Invalid' })
      );

      const beforeLoad = new Date();
      await registry.load();
      const afterLoad = new Date();

      const errors = registry.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].timestamp).toBeInstanceOf(Date);
      expect(errors[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeLoad.getTime());
      expect(errors[0].timestamp.getTime()).toBeLessThanOrEqual(afterLoad.getTime());
    });

    it('should include manifest path in error records', async () => {
      const datasetDir = join(testDatasetsPath, 'test-error');
      await fs.mkdir(datasetDir, { recursive: true });
      await fs.writeFile(
        join(datasetDir, 'manifest.json'),
        JSON.stringify({ name: 'Invalid' })
      );

      await registry.load();

      const errors = registry.getErrors();
      expect(errors[0].manifestPath).toContain('test-error');
      expect(errors[0].manifestPath).toContain('manifest.json');
    });
  });
});
