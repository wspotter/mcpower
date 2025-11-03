import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatasetRegistry } from '../../src/config/datasets.js';

/**
 * Integration tests for server startup behavior
 * 
 * Phase 5: User Story 3 - Server Health Monitoring (T034)
 * Testing dataset discovery and registry statistics during startup
 */

describe('Server Startup Integration', () => {
  let testDatasetsPath: string;

  beforeEach(async () => {
    // Create unique test directory
    testDatasetsPath = join(tmpdir(), `mcpower-startup-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDatasetsPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDatasetsPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Dataset discovery on startup', () => {
    it('should provide statistics for empty directory', async () => {
      const registry = new DatasetRegistry(testDatasetsPath);

      await registry.load();

      const stats = registry.getStats();
      expect(stats.total).toBe(0);
      expect(stats.ready).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it('should provide statistics for valid datasets', async () => {
      // Create a valid dataset
      const datasetDir = join(testDatasetsPath, 'test-dataset');
      await fs.mkdir(datasetDir, { recursive: true });
      const indexPath = join(datasetDir, 'index');
      const metadataPath = join(datasetDir, 'metadata.json');
      await fs.mkdir(indexPath, { recursive: true });
      await fs.writeFile(metadataPath, '{}');
      await fs.writeFile(
        join(datasetDir, 'manifest.json'),
        JSON.stringify({
          id: 'test-dataset',
          name: 'Test Dataset',
          description: 'Test',
          index: indexPath,
          metadata: metadataPath,
          defaultTopK: 5
        })
      );

      const registry = new DatasetRegistry(testDatasetsPath);

      await registry.load();

      const stats = registry.getStats();
      expect(stats.total).toBe(1);
      expect(stats.ready).toBe(1);
      expect(stats.errors).toBe(0);
    });

    it('should provide statistics including errors', async () => {
      // Create one valid and one invalid dataset
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
          name: 'Valid',
          description: 'Test',
          index: indexPath,
          metadata: metadataPath,
          defaultTopK: 5
        })
      );

      const invalidDir = join(testDatasetsPath, 'invalid');
      await fs.mkdir(invalidDir, { recursive: true });
      await fs.writeFile(
        join(invalidDir, 'manifest.json'),
        JSON.stringify({ name: 'No ID' })
      );

      const registry = new DatasetRegistry(testDatasetsPath);

      await registry.load();

      const stats = registry.getStats();
      expect(stats.total).toBe(2);
      expect(stats.ready).toBe(1);
      expect(stats.errors).toBe(1);
    });

    it('should track error details', async () => {
      // Create invalid dataset
      const invalidDir = join(testDatasetsPath, 'broken');
      await fs.mkdir(invalidDir, { recursive: true });
      await fs.writeFile(
        join(invalidDir, 'manifest.json'),
        '{ invalid json }'
      );

      const registry = new DatasetRegistry(testDatasetsPath);

      await registry.load();

      const errors = registry.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toHaveProperty('manifestPath');
      expect(errors[0]).toHaveProperty('error');
      expect(errors[0]).toHaveProperty('timestamp');
    });

    it('should handle nonexistent directory gracefully', async () => {
      const nonexistentDir = join(tmpdir(), `nonexistent-${Date.now()}`);
      const registry = new DatasetRegistry(nonexistentDir);

      await registry.load();

      const stats = registry.getStats();
      expect(stats.total).toBe(0);
      expect(stats.ready).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it('should list ready datasets separately from errored ones', async () => {
      // Create one valid and one invalid dataset
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
          name: 'Valid',
          description: 'Test',
          index: indexPath,
          metadata: metadataPath,
          defaultTopK: 5
        })
      );

      const invalidDir = join(testDatasetsPath, 'invalid');
      await fs.mkdir(invalidDir, { recursive: true });
      await fs.writeFile(
        join(invalidDir, 'manifest.json'),
        JSON.stringify({ name: 'No ID' })
      );

      const registry = new DatasetRegistry(testDatasetsPath);

      await registry.load();

      const ready = registry.listReady();
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('valid');

      // Only successfully loaded datasets are in the list
      const all = registry.list();
      expect(all).toHaveLength(1);

      // Errors are tracked separately
      const errors = registry.getErrors();
      expect(errors).toHaveLength(1);
    });

    it('should continue loading datasets after encountering errors', async () => {
      // Create broken, valid, another-broken sequence
      const broken1Dir = join(testDatasetsPath, 'broken1');
      await fs.mkdir(broken1Dir, { recursive: true });
      await fs.writeFile(
        join(broken1Dir, 'manifest.json'),
        '{ invalid }'
      );

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
          name: 'Valid',
          description: 'Test',
          index: indexPath,
          metadata: metadataPath,
          defaultTopK: 5
        })
      );

      const broken2Dir = join(testDatasetsPath, 'broken2');
      await fs.mkdir(broken2Dir, { recursive: true });
      await fs.writeFile(
        join(broken2Dir, 'manifest.json'),
        JSON.stringify({ id: 'broken2' }) // Missing required fields
      );

      const registry = new DatasetRegistry(testDatasetsPath);

      await registry.load();

      const stats = registry.getStats();
      expect(stats.ready).toBe(1);
      expect(stats.errors).toBe(2);
      expect(registry.has('valid')).toBe(true);
    });
  });

  describe('Dataset access during startup', () => {
    it('should allow access to loaded datasets', async () => {
      const datasetDir = join(testDatasetsPath, 'accessible');
      await fs.mkdir(datasetDir, { recursive: true });
      const indexPath = join(datasetDir, 'index');
      const metadataPath = join(datasetDir, 'metadata.json');
      await fs.mkdir(indexPath, { recursive: true });
      await fs.writeFile(metadataPath, '{}');
      await fs.writeFile(
        join(datasetDir, 'manifest.json'),
        JSON.stringify({
          id: 'accessible',
          name: 'Accessible Dataset',
          description: 'Should be accessible',
          index: indexPath,
          metadata: metadataPath,
          defaultTopK: 5
        })
      );

      const registry = new DatasetRegistry(testDatasetsPath);

      await registry.load();

      const dataset = registry.get('accessible');
      expect(dataset).toBeDefined();
      expect(dataset?.name).toBe('Accessible Dataset');
      expect(dataset?.index).toBe(indexPath);
      expect(dataset?.metadata).toBe(metadataPath);
    });

    it('should return undefined for non-existent datasets', async () => {
      const registry = new DatasetRegistry(testDatasetsPath);

      await registry.load();

      const dataset = registry.get('nonexistent');
      expect(dataset).toBeUndefined();
    });
  });
});
