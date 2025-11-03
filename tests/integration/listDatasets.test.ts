import { describe, it, expect, beforeAll } from 'vitest';
import { DatasetRegistry } from '../../dist/config/datasets.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Integration tests for knowledge.listDatasets tool
 * 
 * Phase 4: User Story 2 - Dataset Discovery (T028)
 * Testing end-to-end dataset listing with real DatasetRegistry
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('knowledge.listDatasets integration', () => {
  let testDatasetsPath: string;
  let registry: DatasetRegistry;

  beforeAll(async () => {
    // Create temporary datasets directory with test datasets
    testDatasetsPath = path.join(__dirname, '../../tmp/test-datasets-list');
    await fs.mkdir(testDatasetsPath, { recursive: true });

    // Create a valid dataset
    const validDatasetPath = path.join(testDatasetsPath, 'valid-dataset');
    await fs.mkdir(validDatasetPath, { recursive: true });
    const validIndexPath = path.join(validDatasetPath, 'index');
    const validMetadataPath = path.join(validDatasetPath, 'metadata.json');
    await fs.writeFile(
      path.join(validDatasetPath, 'manifest.json'),
      JSON.stringify({
        id: 'valid-dataset',
        name: 'Valid Test Dataset',
        description: 'A valid test dataset',
        index: validIndexPath,
        metadata: validMetadataPath,
      })
    );
    // Create placeholder files so validation passes
    await fs.mkdir(validIndexPath, { recursive: true });
    await fs.writeFile(validMetadataPath, '{}');

    // Create another valid dataset
    const anotherValidPath = path.join(testDatasetsPath, 'another-valid');
    await fs.mkdir(anotherValidPath, { recursive: true });
    const anotherIndexPath = path.join(anotherValidPath, 'index');
    const anotherMetadataPath = path.join(anotherValidPath, 'metadata.json');
    await fs.writeFile(
      path.join(anotherValidPath, 'manifest.json'),
      JSON.stringify({
        id: 'another-valid',
        name: 'Another Valid Dataset',
        description: 'Another test dataset',
        index: anotherIndexPath,
        metadata: anotherMetadataPath,
      })
    );
    // Create placeholder files
    await fs.mkdir(anotherIndexPath, { recursive: true });
    await fs.writeFile(anotherMetadataPath, '{}');

    // Create an invalid dataset (missing required fields)
    const invalidDatasetPath = path.join(testDatasetsPath, 'invalid-dataset');
    await fs.mkdir(invalidDatasetPath, { recursive: true });
    await fs.writeFile(
      path.join(invalidDatasetPath, 'manifest.json'),
      JSON.stringify({
        name: 'Invalid Dataset',
        // Missing id, description, index, metadata
      })
    );

    // Load the registry
    registry = new DatasetRegistry(testDatasetsPath);
    await registry.load();
  });

  describe('listReady()', () => {
    it('should return only valid datasets', () => {
      const ready = registry.listReady();
      expect(ready).toHaveLength(2);
      expect(ready.map((d) => d.id).sort()).toEqual(['another-valid', 'valid-dataset']);
    });

    it('should include all dataset fields', () => {
      const ready = registry.listReady();
      const first = ready[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('description');
      expect(first).toHaveProperty('index');
      expect(first).toHaveProperty('metadata');
    });
  });

  describe('list()', () => {
    it('should return all successfully loaded datasets', () => {
      const all = registry.list();
      expect(all).toHaveLength(2); // Only successfully loaded datasets
      expect(all.map((d) => d.id).sort()).toEqual([
        'another-valid',
        'valid-dataset',
      ]);
    });
  });

  describe('getErrors()', () => {
    it('should return errors for invalid datasets', () => {
      const errors = registry.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].manifestPath).toContain('invalid-dataset');
      expect(errors[0].error).toContain('Required'); // Zod validation error
    });

    it('should include error details', () => {
      const errors = registry.getErrors();
      const error = errors[0];
      expect(error).toHaveProperty('manifestPath');
      expect(error).toHaveProperty('error');
      expect(error).toHaveProperty('timestamp');
      expect(error.manifestPath).toContain('invalid-dataset');
    });
  });
});
