# Data Model: Core MCP Server with Knowledge Search

**Feature**: 001-mcp-server-core  
**Created**: 2025-11-02  
**Status**: Complete

## Overview

This document defines the core data entities, their relationships, validation rules, and state transitions for the MCP knowledge search server. All entities are TypeScript interfaces with corresponding Zod schemas for runtime validation.

---

## Entity 1: Dataset

### Description
Represents a registered knowledge dataset with embedded documents. Each dataset has a unique identifier, metadata for discovery, and file system paths to FAISS index and metadata files.

### Fields

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | string | Yes | Regex: `^[a-z0-9-]+$`, 1-64 chars | Unique dataset identifier (lowercase alphanumeric with hyphens) |
| name | string | Yes | 1-128 chars | Human-readable dataset name for display |
| description | string | Yes | 1-512 chars | Brief description of dataset contents and purpose |
| index | string | Yes | Valid directory path | Absolute or relative path to FAISS index directory |
| metadata | string | Yes | Valid file path | Absolute or relative path to metadata JSON file |
| defaultTopK | number | No | Integer 1-100, default: 5 | Default number of results to return for searches |

### Validation Rules
1. Dataset ID MUST be unique across all registered datasets
2. Index path MUST point to an existing directory containing FAISS index files
3. Metadata path MUST point to an existing JSON file
4. All string fields MUST NOT contain only whitespace
5. Dataset ID MUST NOT contain uppercase letters or special characters (except hyphens)

### Relationships
- One Dataset has many SearchResults (via search queries)
- One Dataset has one DatasetManifest (one-to-one, manifest defines dataset)

### State Lifecycle
1. **Unloaded**: Manifest file exists but not yet validated
2. **Validating**: Manifest schema validation in progress
3. **Invalid**: Validation failed, dataset excluded from registry
4. **Loading**: Index and metadata files being verified
5. **Ready**: Dataset registered and available for searches
6. **Error**: Index/metadata missing or corrupted, dataset unavailable

### Example
```json
{
  "id": "cherry-docs",
  "name": "Cherry Studio Documentation",
  "description": "Embeddings built from the Cherry Studio docs repository",
  "index": "./datasets/cherry-docs/docs.index",
  "metadata": "./datasets/cherry-docs/metadata.json",
  "defaultTopK": 5
}
```

---

## Entity 2: DatasetManifest

### Description
JSON configuration file that defines dataset registration. Stored in the `datasets/` directory with filename pattern `{dataset-id}/manifest.json`. This is the physical file representation of the Dataset entity.

### Fields
Same as Dataset entity (DatasetManifest and Dataset share the same schema).

### Validation Rules
1. MUST be valid JSON parseable by `JSON.parse()`
2. MUST conform to DatasetManifestSchema (Zod validation)
3. File MUST be readable by Node.js process
4. File size MUST be <10KB (reasonable limit for JSON manifest)

### Relationships
- One DatasetManifest defines one Dataset (one-to-one)

### Storage Location
- Path pattern: `datasets/{dataset-id}/manifest.json`
- Example: `datasets/cherry-docs/manifest.json`

### Loading Strategy
- Scan `datasets/` directory on server startup
- Recursively find all `manifest.json` files
- Parse and validate each manifest
- Log errors for invalid manifests, continue with valid ones

---

## Entity 3: SearchResult

### Description
A single result from a knowledge search query. Contains relevance score, document metadata, and text snippet for display to the user. Results are ephemeral (not persisted) and returned directly to MCP clients.

### Fields

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| score | number | Yes | Float 0.0-1.0 | Similarity/relevance score from FAISS (higher = more relevant) |
| title | string | Yes | 1-256 chars | Document title or heading |
| path | string | Yes | 1-512 chars | Document path or URL for citation/attribution |
| snippet | string | Yes | 0-2048 chars | Text excerpt from matched document content |

### Validation Rules
1. Score MUST be between 0.0 and 1.0 inclusive
2. Path MUST be non-empty (required for attribution per SC-004)
3. Snippet MAY be empty if document has no extractable text
4. Title MUST be non-empty (fallback to path basename if not available)

### Relationships
- Many SearchResults belong to one SearchQuery (one-to-many)
- Each SearchResult references one Dataset (via datasetId in parent query)

### Derived Fields
These fields are computed by the Python bridge from FAISS results:
- `score`: Cosine similarity or L2 distance from FAISS
- `title`: Extracted from metadata JSON
- `path`: Stored in metadata JSON
- `snippet`: Extracted from document text based on match position

### Example
```json
{
  "score": 0.8934,
  "title": "Installation Guide",
  "path": "docs/getting-started/installation.md",
  "snippet": "To install Cherry Studio, first ensure you have Node.js 18+ installed..."
}
```

---

## Entity 4: SearchQuery

### Description
User input for a knowledge search operation. Passed to the `knowledge.search` MCP tool and forwarded to the Python bridge. Ephemeral entity (not persisted).

### Fields

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| dataset | string | Yes | Must match registered dataset ID | Target dataset to search |
| query | string | Yes | 1-1024 chars, non-whitespace | Natural language search query |
| topK | number | No | Integer 1-100, default: dataset.defaultTopK | Number of results to return |

### Validation Rules
1. Dataset ID MUST exist in loaded dataset registry
2. Query MUST NOT be empty or only whitespace
3. TopK MUST be positive integer between 1 and 100
4. Query length MUST NOT exceed 1024 characters (reasonable text input limit)

### Relationships
- One SearchQuery targets one Dataset (many-to-one)
- One SearchQuery produces many SearchResults (one-to-many)

### Processing Flow
1. MCP client sends SearchQuery to `knowledge.search` tool
2. TypeScript validates input via Zod schema
3. TypeScript forwards to Python bridge with dataset index path
4. Python bridge queries FAISS and returns SearchResult array
5. TypeScript returns results to MCP client

### Example
```json
{
  "dataset": "cherry-docs",
  "query": "How do I configure the MCP server settings?",
  "topK": 5
}
```

---

## Entity 5: DatasetRegistry

### Description
In-memory collection of all successfully loaded datasets. Singleton instance managed by the server, populated on startup. This is not a persisted entity but a runtime data structure.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| datasets | Map<string, Dataset> | Map of dataset ID to Dataset object |
| loadErrors | Array<DatasetError> | List of datasets that failed to load with error details |

### Operations
- `get(id: string): Dataset | undefined` - Retrieve dataset by ID
- `list(): Dataset[]` - Get all registered datasets
- `has(id: string): boolean` - Check if dataset exists
- `getErrors(): DatasetError[]` - Get all loading errors for diagnostics

### Lifecycle
1. **Initialization**: Empty registry created on server startup
2. **Discovery**: Scan `datasets/` directory for manifest files
3. **Loading**: Validate and register each dataset
4. **Ready**: Registry populated, searches can proceed
5. **Runtime**: No modifications (datasets not hot-reloadable in v0.1.0)

### Validation Strategy
For each discovered manifest:
1. Parse JSON file
2. Validate against DatasetManifestSchema
3. Verify index directory exists and is readable
4. Verify metadata file exists and is parseable
5. If all checks pass: Add to `datasets` map
6. If any check fails: Add to `loadErrors` array, log error, continue

---

## Entity 6: PythonBridgeRequest

### Description
Internal request structure passed to Python bridge subprocess. Not exposed to MCP clients. Represents the command-line arguments for the Python bridge script.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| command | 'search' | Yes | Bridge command to execute |
| indexPath | string | Yes | Absolute path to FAISS index directory |
| query | string | Yes | Search query text |
| topK | number | Yes | Number of results to return |

### Command-Line Mapping
```bash
python python/bridge.py search \
  --index /path/to/dataset/docs.index \
  --query "search text" \
  --k 5
```

### Response Structure
Python bridge returns JSON to stdout:
```json
{
  "results": [
    {
      "score": 0.89,
      "title": "Document Title",
      "path": "docs/file.md",
      "snippet": "Relevant text excerpt..."
    }
  ],
  "duration_ms": 123,
  "dataset_size": 5000
}
```

---

## Validation Summary

| Entity | Validation Method | Error Handling |
|--------|------------------|----------------|
| Dataset | Zod schema (DatasetManifestSchema) | Log error, exclude from registry |
| DatasetManifest | Zod schema + file existence checks | Log error, exclude from registry |
| SearchResult | Zod schema (returned from Python) | Throw error, fail search request |
| SearchQuery | Zod schema (MCP tool input) | Return MCP error to client |
| DatasetRegistry | Aggregate validation on startup | Log all errors, continue with valid datasets |
| PythonBridgeRequest | Type checking (internal only) | Throw error, fail search request |

---

## State Transition Diagram

### Dataset Lifecycle
```
[manifest.json discovered]
         ↓
    [Unloaded]
         ↓
  [Validating] ──→ [Invalid] ──→ [Logged + Excluded]
         ↓
    [Loading]
         ↓
  [Verify Files] ──→ [Error] ──→ [Logged + Excluded]
         ↓
     [Ready] ──→ [Available for Searches]
```

### Search Request Lifecycle
```
[MCP Client] → [SearchQuery]
                    ↓
              [Validate Input] ──→ [Invalid] ──→ [MCP Error Response]
                    ↓
              [Python Bridge]
                    ↓
              [FAISS Search]
                    ↓
              [SearchResults] ──→ [MCP Success Response]
```

---

## TypeScript Type Definitions

### Complete Type System
```typescript
import { z } from 'zod';

// Dataset/Manifest Schema
export const DatasetManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(512),
  index: z.string().min(1),
  metadata: z.string().min(1),
  defaultTopK: z.number().int().min(1).max(100).default(5)
});

export type Dataset = z.infer<typeof DatasetManifestSchema>;
export type DatasetManifest = Dataset; // Alias for clarity

// Search Result Schema
export const SearchResultSchema = z.object({
  score: z.number().min(0).max(1),
  title: z.string().min(1).max(256),
  path: z.string().min(1).max(512),
  snippet: z.string().max(2048)
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// Search Query Schema (MCP tool input)
export const SearchQuerySchema = z.object({
  dataset: z.string().min(1),
  query: z.string().min(1).max(1024).trim(),
  topK: z.number().int().min(1).max(100).optional()
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// Dataset Registry (internal)
export interface DatasetRegistry {
  datasets: Map<string, Dataset>;
  loadErrors: DatasetError[];
}

export interface DatasetError {
  manifestPath: string;
  error: string;
  timestamp: Date;
}

// Python Bridge Request (internal)
export interface PythonBridgeRequest {
  command: 'search';
  indexPath: string;
  query: string;
  topK: number;
}

// Python Bridge Response (internal)
export interface PythonBridgeResponse {
  results: SearchResult[];
  duration_ms: number;
  dataset_size: number;
}
```

---

## Notes

- All schemas use Zod for both TypeScript type inference and runtime validation
- Dataset IDs are immutable once registered (no runtime updates)
- Search results are never persisted (ephemeral responses)
- Python bridge response includes metadata (duration, dataset size) for observability
- All file paths in manifests are resolved relative to project root during loading
