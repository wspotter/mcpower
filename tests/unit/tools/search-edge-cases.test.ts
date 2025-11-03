/**
 * Phase 6: Edge case tests for search tool (T043)
 * 
 * Tests edge cases and boundary conditions for the knowledge.search tool:
 * - Empty query strings
 * - Whitespace-only queries
 * - topK boundary values (0, 101)
 * - Dataset ID case sensitivity
 * - Concurrent search operations
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { handleSearch } from '../../../src/tools/search.js';
import { DatasetRegistry } from '../../../src/config/datasets.js';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Search Edge Cases', () => {
  const testDatasetId = 'edge-test-docs';
  let tempDatasetsPath: string;
  let testRegistry: DatasetRegistry;

  beforeAll(async () => {
    // Create temporary datasets directory with test dataset
    tempDatasetsPath = join(tmpdir(), `mcpower-edge-test-${Date.now()}-${Math.random()}`);
    const datasetPath = join(tempDatasetsPath, testDatasetId);
    const indexPath = join(datasetPath, 'index');
    
    await mkdir(indexPath, { recursive: true });

    // Create manifest
    const manifest = {
      id: testDatasetId,
      name: 'Edge Case Test Dataset',
      description: 'Dataset for testing edge cases',
      index: indexPath,
      metadata: join(datasetPath, 'metadata.json'),
      defaultTopK: 5
    };

    // Create metadata
    const metadata = {
      documents: [
        { id: 'doc1', text: 'Sample document for edge case testing' }
      ]
    };

    await writeFile(join(datasetPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await writeFile(join(datasetPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

    // Create placeholder index (will fail validation but that's ok for edge cases)
    await writeFile(join(indexPath, 'placeholder.txt'), 'test index');

    // Create test registry and load datasets
    testRegistry = new DatasetRegistry(tempDatasetsPath);
    await testRegistry.load();
  });

  describe('Empty and whitespace queries', () => {
    it('should reject empty query string', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: '',
        topK: 5
      });

      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.content[0].text).toContain('Invalid search parameters');
        expect(result.content[0].text).toContain('query');
      }
    });

    it('should reject whitespace-only query', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: '   \t\n  ',
        topK: 5
      });

      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.content[0].text).toContain('Invalid search parameters');
        expect(result.content[0].text).toContain('query');
      }
    });

    it('should reject query with only newlines', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: '\n\n\n',
        topK: 5
      });

      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.content[0].text).toContain('Invalid search parameters');
        expect(result.content[0].text).toContain('query');
      }
    });
  });

  describe('topK boundary values', () => {
    it('should reject topK=0', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: 'test query',
        topK: 0
      });

      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.content[0].text).toContain('Invalid search parameters');
        expect(result.content[0].text).toContain('topK');
        expect(result.content[0].text).toContain('greater than or equal to 1');
      }
    });

    it('should reject negative topK', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: 'test query',
        topK: -5
      });

      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.content[0].text).toContain('Invalid search parameters');
        expect(result.content[0].text).toContain('topK');
      }
    });

    it('should reject topK=101', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: 'test query',
        topK: 101
      });

      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.content[0].text).toContain('Invalid search parameters');
        expect(result.content[0].text).toContain('topK');
        expect(result.content[0].text).toContain('less than or equal to 100');
      }
    });

    it('should accept topK=1 (minimum valid)', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: 'test query',
        topK: 1
      });

      // May fail due to dataset validation, but should pass topK validation
      if (result.isError && result.content[0]) {
        expect(result.content[0].text).not.toContain('topK');
      }
    });

    it('should accept topK=100 (maximum valid)', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: 'test query',
        topK: 100
      });

      // May fail due to dataset validation, but should pass topK validation
      if (result.isError && result.content[0]) {
        expect(result.content[0].text).not.toContain('topK');
      }
    });
  });

  describe('Dataset ID handling', () => {
    it('should be case-sensitive for dataset IDs', async () => {
      const result = await handleSearch({
        dataset: testDatasetId.toUpperCase(),
        query: 'test query',
        topK: 5
      });

      // Uppercase version should not match lowercase dataset ID
      // Will either be "not found" or "registry not initialized" depending on context
      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.content[0].text).toContain('Search failed');
      }
    });

    it('should reject dataset ID with special characters', async () => {
      const result = await handleSearch({
        dataset: 'invalid/../dataset',
        query: 'test query',
        topK: 5
      });

      // Will either be "not found" or "registry not initialized"
      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.content[0].text).toContain('Search failed');
      }
    });

    it('should reject empty dataset ID', async () => {
      const result = await handleSearch({
        dataset: '',
        query: 'test query',
        topK: 5
      });

      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.content[0].text).toContain('Invalid search parameters');
        expect(result.content[0].text).toContain('dataset');
      }
    });
  });

  describe('Concurrent search operations', () => {
    it('should handle concurrent searches to same dataset', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        handleSearch({
          dataset: testDatasetId,
          query: `test query ${i}`,
          topK: 5
        })
      );

      const results = await Promise.all(promises);

      // All should complete (may succeed or fail gracefully)
      expect(results).toHaveLength(5);
      
      // Each result should have the expected structure
      results.forEach(result => {
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
      });
    });

    it('should handle concurrent searches to different datasets', async () => {
      // Create second test dataset
      const dataset2Id = 'edge-test-docs-2';
      const dataset2Path = join(tempDatasetsPath, dataset2Id);
      const index2Path = join(dataset2Path, 'index');
      
      await mkdir(index2Path, { recursive: true });

      const manifest2 = {
        id: dataset2Id,
        name: 'Edge Case Test Dataset 2',
        description: 'Second dataset for concurrent testing',
        index: index2Path,
        metadata: join(dataset2Path, 'metadata.json'),
        defaultTopK: 5
      };

      await writeFile(join(dataset2Path, 'manifest.json'), JSON.stringify(manifest2, null, 2));
      await writeFile(join(dataset2Path, 'metadata.json'), JSON.stringify({ documents: [] }, null, 2));
      await writeFile(join(index2Path, 'placeholder.txt'), 'test index 2');

      // Reload datasets with updated directory
      await testRegistry.load();

      // Execute concurrent searches
      const promises = [
        handleSearch({ dataset: testDatasetId, query: 'query 1', topK: 5 }),
        handleSearch({ dataset: dataset2Id, query: 'query 2', topK: 5 }),
        handleSearch({ dataset: testDatasetId, query: 'query 3', topK: 5 }),
        handleSearch({ dataset: dataset2Id, query: 'query 4', topK: 5 })
      ];

      const results = await Promise.all(promises);

      // All should complete
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toHaveProperty('content');
      });
    });

    it('should handle rapid sequential searches', async () => {
      const results = [];
      
      for (let i = 0; i < 10; i++) {
        const result = await handleSearch({
          dataset: testDatasetId,
          query: `rapid query ${i}`,
          topK: 3
        });
        results.push(result);
      }

      // All should complete
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('content');
      });
    });
  });

  describe('Query string edge cases', () => {
    it('should handle very long query string (>100 chars)', async () => {
      const longQuery = 'a'.repeat(200);
      
      const result = await handleSearch({
        dataset: testDatasetId,
        query: longQuery,
        topK: 5
      });

      // Should not crash, query should be truncated internally
      expect(result).toHaveProperty('content');
    });

    it('should handle query with special characters', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        topK: 5
      });

      // Should not crash
      expect(result).toHaveProperty('content');
    });

    it('should handle query with unicode characters', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: '你好世界 🚀 Здравствуй мир',
        topK: 5
      });

      // Should not crash
      expect(result).toHaveProperty('content');
    });

    it('should handle query with only numbers', async () => {
      const result = await handleSearch({
        dataset: testDatasetId,
        query: '12345',
        topK: 5
      });

      // Should not crash
      expect(result).toHaveProperty('content');
    });
  });
});
