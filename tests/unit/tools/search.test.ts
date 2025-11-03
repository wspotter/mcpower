import { describe, it, expect } from 'vitest';
import { SearchQuerySchema } from '../../../src/types/searchQuery.js';

describe('SearchQuerySchema Validation', () => {
  describe('Valid inputs', () => {
    it('should accept valid search query with all fields', () => {
      const input = {
        dataset: 'cherry-docs',
        query: 'How do I install?',
        topK: 5
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dataset).toBe('cherry-docs');
        expect(result.data.query).toBe('How do I install?');
        expect(result.data.topK).toBe(5);
      }
    });

    it('should accept valid search query without optional topK', () => {
      const input = {
        dataset: 'openwebui-docs',
        query: 'What are the system requirements?'
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topK).toBeUndefined();
      }
    });

    it('should trim whitespace from query', () => {
      const input = {
        dataset: 'test-docs',
        query: '  search with spaces  '
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe('search with spaces');
      }
    });

    it('should accept topK at boundary values', () => {
      const minInput = {
        dataset: 'test-docs',
        query: 'test',
        topK: 1
      };

      const maxInput = {
        dataset: 'test-docs',
        query: 'test',
        topK: 100
      };

      expect(SearchQuerySchema.safeParse(minInput).success).toBe(true);
      expect(SearchQuerySchema.safeParse(maxInput).success).toBe(true);
    });
  });

  describe('Invalid inputs - missing required fields', () => {
    it('should reject query without dataset', () => {
      const input = {
        query: 'test query'
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('dataset');
      }
    });

    it('should reject query without query text', () => {
      const input = {
        dataset: 'test-docs'
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('query');
      }
    });

    it('should reject empty query string', () => {
      const input = {
        dataset: 'test-docs',
        query: ''
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject whitespace-only query', () => {
      const input = {
        dataset: 'test-docs',
        query: '   '
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - topK constraints', () => {
    it('should reject topK = 0', () => {
      const input = {
        dataset: 'test-docs',
        query: 'test',
        topK: 0
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject negative topK', () => {
      const input = {
        dataset: 'test-docs',
        query: 'test',
        topK: -1
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject topK > 100', () => {
      const input = {
        dataset: 'test-docs',
        query: 'test',
        topK: 101
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer topK', () => {
      const input = {
        dataset: 'test-docs',
        query: 'test',
        topK: 5.5
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - dataset constraints', () => {
    it('should reject empty dataset', () => {
      const input = {
        dataset: '',
        query: 'test'
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject dataset longer than 64 characters', () => {
      const input = {
        dataset: 'a'.repeat(65),
        query: 'test'
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - query constraints', () => {
    it('should reject query longer than 1024 characters', () => {
      const input = {
        dataset: 'test-docs',
        query: 'a'.repeat(1025)
      };

      const result = SearchQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
