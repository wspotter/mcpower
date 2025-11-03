import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Unit tests for knowledge.listDatasets tool input schema
 * 
 * Phase 4: User Story 2 - Dataset Discovery (T027)
 * Testing ListDatasetsArgsSchema validation
 */

// Define the schema we expect for listDatasets arguments
export const ListDatasetsArgsSchema = z
  .object({
    includeErrors: z.boolean().optional().default(false),
  })
  .strict();

type ListDatasetsArgs = z.infer<typeof ListDatasetsArgsSchema>;

describe('ListDatasetsArgsSchema', () => {
  describe('Valid inputs', () => {
    it('should accept empty object (no arguments)', () => {
      const result = ListDatasetsArgsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeErrors).toBe(false); // Default value
      }
    });

    it('should accept includeErrors: true', () => {
      const result = ListDatasetsArgsSchema.safeParse({ includeErrors: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeErrors).toBe(true);
      }
    });

    it('should accept includeErrors: false', () => {
      const result = ListDatasetsArgsSchema.safeParse({ includeErrors: false });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeErrors).toBe(false);
      }
    });
  });

  describe('Invalid inputs', () => {
    it('should reject includeErrors as string', () => {
      const result = ListDatasetsArgsSchema.safeParse({ includeErrors: 'true' });
      expect(result.success).toBe(false);
    });

    it('should reject includeErrors as number', () => {
      const result = ListDatasetsArgsSchema.safeParse({ includeErrors: 1 });
      expect(result.success).toBe(false);
    });

    it('should reject unknown properties', () => {
      const result = ListDatasetsArgsSchema.safeParse({
        includeErrors: true,
        unknownField: 'value',
      });
      expect(result.success).toBe(false);
    });

    it('should reject null', () => {
      const result = ListDatasetsArgsSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should reject undefined', () => {
      const result = ListDatasetsArgsSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('should reject arrays', () => {
      const result = ListDatasetsArgsSchema.safeParse([]);
      expect(result.success).toBe(false);
    });
  });
});
