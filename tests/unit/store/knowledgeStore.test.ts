import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeStore } from '../../../src/store/knowledgeStore.js';
import { Dataset } from '../../../src/types/dataset.js';
import { PythonBridgeResponse } from '../../../src/types/searchResult.js';
import * as pythonBridgeModule from '../../../src/bridge/pythonBridge.js';

// Mock the Python bridge
vi.mock('../../../src/bridge/pythonBridge.js', () => ({
  pythonBridge: {
    search: vi.fn()
  }
}));

describe('KnowledgeStore', () => {
  let store: KnowledgeStore;
  let mockDataset: Dataset;

  beforeEach(() => {
    mockDataset = {
      id: 'test-docs',
      name: 'Test Documentation',
      description: 'Test dataset for unit tests',
      index: '/fake/path/to/index',
      metadata: '/fake/path/to/metadata.json',
      defaultTopK: 5
    };

    store = new KnowledgeStore(mockDataset);
    vi.clearAllMocks();
  });

  describe('search()', () => {
    it('should return search results from Python bridge', async () => {
      const mockResponse: PythonBridgeResponse = {
        results: [
          {
            score: 0.89,
            title: 'Installation Guide',
            path: 'docs/install.md',
            snippet: 'To install, run npm install...'
          },
          {
            score: 0.76,
            title: 'Configuration',
            path: 'docs/config.md',
            snippet: 'Configure the server by...'
          }
        ],
        duration_ms: 45,
        dataset_size: 1000
      };

      vi.mocked(pythonBridgeModule.pythonBridge.search).mockResolvedValue(mockResponse);

      const results = await store.search('how to install', 5);

      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.89);
      expect(results[0].title).toBe('Installation Guide');
      expect(results[1].score).toBe(0.76);
    });

    it('should use default topK if not provided', async () => {
      const mockResponse: PythonBridgeResponse = {
        results: [],
        duration_ms: 20,
        dataset_size: 1000
      };

      vi.mocked(pythonBridgeModule.pythonBridge.search).mockResolvedValue(mockResponse);

      await store.search('test query');

      expect(pythonBridgeModule.pythonBridge.search).toHaveBeenCalledWith(
        expect.objectContaining({
          topK: 5 // Uses dataset.defaultTopK
        })
      );
    });

    it('should use provided topK over default', async () => {
      const mockResponse: PythonBridgeResponse = {
        results: [],
        duration_ms: 20,
        dataset_size: 1000
      };

      vi.mocked(pythonBridgeModule.pythonBridge.search).mockResolvedValue(mockResponse);

      await store.search('test query', 10);

      expect(pythonBridgeModule.pythonBridge.search).toHaveBeenCalledWith(
        expect.objectContaining({
          topK: 10
        })
      );
    });

    it('should pass correct request to Python bridge', async () => {
      const mockResponse: PythonBridgeResponse = {
        results: [],
        duration_ms: 20,
        dataset_size: 1000
      };

      vi.mocked(pythonBridgeModule.pythonBridge.search).mockResolvedValue(mockResponse);

      await store.search('test query', 7);

      expect(pythonBridgeModule.pythonBridge.search).toHaveBeenCalledWith({
        command: 'search',
        indexPath: '/fake/path/to/index',
        metadataPath: '/fake/path/to/metadata.json',
        query: 'test query',
        topK: 7
      });
    });

    it('should retry once on failure after 1s delay', async () => {
      const mockResponse: PythonBridgeResponse = {
        results: [
          {
            score: 0.85,
            title: 'Success after retry',
            path: 'docs/test.md',
            snippet: 'Content...'
          }
        ],
        duration_ms: 30,
        dataset_size: 1000
      };

      // First call fails, second succeeds
      vi.mocked(pythonBridgeModule.pythonBridge.search)
        .mockRejectedValueOnce(new Error('Transient failure'))
        .mockResolvedValueOnce(mockResponse);

      const startTime = Date.now();
      const results = await store.search('test query');
      const elapsed = Date.now() - startTime;

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Success after retry');
      expect(elapsed).toBeGreaterThanOrEqual(1000); // Should have delayed ~1s
      expect(pythonBridgeModule.pythonBridge.search).toHaveBeenCalledTimes(2);
    });

    it('should throw error if retry also fails', async () => {
      vi.mocked(pythonBridgeModule.pythonBridge.search)
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));

      await expect(store.search('test query')).rejects.toThrow(
        /Search failed for dataset test-docs/
      );

      expect(pythonBridgeModule.pythonBridge.search).toHaveBeenCalledTimes(2);
    });

    it('should handle empty results', async () => {
      const mockResponse: PythonBridgeResponse = {
        results: [],
        duration_ms: 15,
        dataset_size: 1000
      };

      vi.mocked(pythonBridgeModule.pythonBridge.search).mockResolvedValue(mockResponse);

      const results = await store.search('nonexistent query');

      expect(results).toHaveLength(0);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getDataset()', () => {
    it('should return the dataset information', () => {
      const dataset = store.getDataset();

      expect(dataset.id).toBe('test-docs');
      expect(dataset.name).toBe('Test Documentation');
      expect(dataset.defaultTopK).toBe(5);
    });
  });
});
