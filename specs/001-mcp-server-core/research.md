# Research: Core MCP Server with Knowledge Search

**Feature**: 001-mcp-server-core  
**Created**: 2025-11-02  
**Status**: Complete

## Overview

This document consolidates research findings for implementing an MCP server with knowledge search capabilities. All technical unknowns from the implementation plan have been resolved through analysis of the MCP SDK documentation, FAISS integration patterns, and subprocess management best practices in Node.js.

---

## Research Area 1: MCP SDK Tool Registration and Schema Validation

### Decision
Use `@modelcontextprotocol/sdk` package v1.x with Zod for input schema validation. Tools will be registered using the `server.tool()` method with explicit Zod schemas defining required and optional parameters.

### Rationale
- Official MCP SDK provides type-safe tool registration with built-in validation
- Zod integration is the recommended approach in MCP SDK documentation
- Provides automatic OpenAPI-style schema generation for MCP clients
- Compile-time type safety for tool parameters and responses

### Implementation Approach
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { z } from 'zod';

const SearchInputSchema = z.object({
  dataset: z.string().min(1).describe('Dataset ID to search'),
  query: z.string().min(1).describe('Search query text'),
  topK: z.number().int().min(1).max(100).optional().default(5).describe('Number of results')
});

server.tool({
  name: 'knowledge.search',
  description: 'Search a knowledge dataset for relevant documents',
  inputSchema: SearchInputSchema,
  handler: async (input) => {
    // Implementation
  }
});
```

### Alternatives Considered
- **Manual JSON Schema validation**: More verbose, less type-safe, rejected because Zod is idiomatic for MCP SDK
- **Ajv validator**: Additional dependency, Zod is sufficient and preferred by MCP community
- **No validation (trust clients)**: Violates constitution requirement for input validation (FR-008)

### Reference Materials
- MCP SDK documentation: https://github.com/modelcontextprotocol/typescript-sdk
- Zod documentation: https://zod.dev/
- MCP protocol spec: https://spec.modelcontextprotocol.io/

---

## Research Area 2: Python Bridge Subprocess Management

### Decision
Use `execa` package for spawning and managing Python bridge processes. Implement a connection pool pattern with lazy initialization and per-dataset caching to avoid repeated process spawns.

### Rationale
- `execa` provides better error handling and output parsing than native `child_process`
- Supports streaming stdout/stderr, timeouts, and cancellation
- Connection pooling reduces latency by reusing Python processes across searches
- Per-dataset caching aligns with constitution principle III (cache KnowledgeStore instances)

### Implementation Approach
```typescript
import { execa } from 'execa';

class PythonBridge {
  private processCache = new Map<string, CachedProcess>();
  
  async search(datasetId: string, query: string, topK: number) {
    const result = await execa('python', [
      'python/bridge.py',
      'search',
      '--index', `/path/to/${datasetId}/docs.index`,
      '--query', query,
      '--k', topK.toString()
    ], {
      timeout: 10000, // 10s timeout
      reject: false   // Handle errors manually
    });
    
    if (result.exitCode !== 0) {
      throw new Error(`Python bridge failed: ${result.stderr}`);
    }
    
    return JSON.parse(result.stdout);
  }
}
```

### Alternatives Considered
- **Native child_process.spawn**: Lower-level API, more boilerplate, rejected for ergonomics
- **Python HTTP server**: Adds deployment complexity (two services), increases latency, rejected for simplicity
- **Embedded Python (node-python)**: Fragile native bindings, deployment issues, rejected for reliability
- **Persistent Python daemon**: Over-engineered for initial version, may revisit for performance optimization

### Performance Considerations
- Cold start: 50-100ms Python process spawn + 100-200ms FAISS index load
- Warm cache: 5-10ms process communication overhead
- Target: <500ms p95 includes first Python spawn per dataset
- Mitigation: Pre-warm cache on server startup for all registered datasets

### Reference Materials
- execa documentation: https://github.com/sindresorhus/execa
- Node.js child_process patterns: https://nodejs.org/api/child_process.html

---

## Research Area 3: Dataset Manifest Schema and Validation

### Decision
Define TypeScript interfaces with Zod runtime validation for dataset manifests. Use JSON Schema for documentation purposes but Zod as the single source of truth for validation.

### Rationale
- Zod provides both compile-time types and runtime validation from single definition
- Type safety throughout TypeScript codebase prevents runtime errors
- Zod error messages are user-friendly for manifest validation failures
- Aligns with MCP SDK patterns (consistent validation approach)

### Manifest Schema
```typescript
import { z } from 'zod';

export const DatasetManifestSchema = z.object({
  id: z.string()
    .regex(/^[a-z0-9-]+$/, 'Dataset ID must be alphanumeric with hyphens')
    .min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(512),
  index: z.string().min(1).describe('Path to FAISS index directory'),
  metadata: z.string().min(1).describe('Path to metadata JSON file'),
  defaultTopK: z.number().int().min(1).max(100).default(5)
});

export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;
```

### Validation Strategy
1. Load all JSON files from `datasets/` directory on startup
2. Parse each file with Zod schema
3. Log validation errors with file path and specific field issues
4. Exclude invalid manifests, continue loading valid ones (graceful degradation per SC-007)
5. Verify index and metadata file paths exist before registering dataset

### Alternatives Considered
- **JSON Schema with ajv**: Separate schema files, type/validation split, rejected for maintenance burden
- **Manual validation**: Error-prone, no type safety, rejected for reliability
- **TypeScript interfaces only**: No runtime validation, rejected (violates FR-002)

### Reference Materials
- Zod documentation: https://zod.dev/
- JSON Schema spec: https://json-schema.org/ (reference only)

---

## Research Area 4: Structured Logging with Pino

### Decision
Use `pino` logger with JSON output to stdout, configure via `--log-level` CLI flag (default: `info`). Log all MCP tool invocations, errors, and startup diagnostics per constitution principle IV.

### Rationale
- Pino is fastest Node.js logger with minimal overhead (<5ms per log)
- JSON output integrates with ELK, Loki, CloudWatch, etc.
- Built-in log level management and child loggers for context
- Supports redaction for sensitive data (query sanitization)

### Logging Strategy
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['*.query'] // Optional: redact sensitive queries
});

// Tool invocation logging
logger.info({
  event: 'tool.invocation',
  tool: 'knowledge.search',
  datasetId: 'cherry-docs',
  queryLength: query.length,
  topK: 5,
  durationMs: 234,
  resultCount: 5
}, 'Search completed');

// Error logging
logger.error({
  event: 'python.bridge.error',
  datasetId: 'cherry-docs',
  error: err.message,
  stack: err.stack
}, 'Python bridge failed');
```

### Log Events Catalog
- `server.startup`: Version, datasets loaded, ready status
- `dataset.loaded`: Dataset ID, manifest path, index file validation
- `dataset.error`: Dataset ID, error type, file paths
- `tool.invocation`: Tool name, input params (sanitized), duration, result count
- `python.bridge.call`: Command, args, duration, exit code
- `python.bridge.error`: Error message, stack trace, retry attempts

### Alternatives Considered
- **Winston**: Heavier footprint, complex configuration, rejected for simplicity
- **Bunyan**: Similar to pino but slower, rejected for performance
- **Console.log**: No structured data, no levels, rejected (violates constitution IV)

### Reference Materials
- Pino documentation: https://getpino.io/
- Pino best practices: https://github.com/pinojs/pino/blob/master/docs/best-practices.md

---

## Research Area 5: MCP stdio Transport Implementation

### Decision
Use `@modelcontextprotocol/sdk/server/stdio.js` transport for stdio-based MCP communication. This is the standard transport for CLI-based MCP servers and aligns with VS Code/Copilot integration patterns.

### Rationale
- Built-in MCP SDK transport handles protocol framing and message parsing
- Stdio is the default transport for MCP servers invoked by clients
- No network configuration required (simpler than HTTP transport)
- Process-level isolation provides security boundary

### Implementation Approach
```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({
  name: 'mcpower-knowledge',
  version: '0.1.0'
}, {
  capabilities: {
    tools: {}
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

// Server now listens on stdin and writes to stdout
```

### Client Integration
MCP clients (VS Code, Cherry Studio) will start the server via:
```bash
node dist/cli.js --stdio
```

The client communicates via JSON-RPC over stdin/stdout. All logging goes to stderr to avoid protocol contamination.

### Alternatives Considered
- **HTTP transport with SSE**: More complex deployment, requires port management, rejected for initial version
- **WebSocket transport**: Requires server lifecycle management, rejected for simplicity
- **Custom protocol**: Breaks MCP compatibility, rejected (violates constitution I)

### Reference Materials
- MCP stdio transport: https://spec.modelcontextprotocol.io/specification/basic/transports/#stdio
- MCP SDK transport docs: https://github.com/modelcontextprotocol/typescript-sdk/tree/main/src/server

---

## Research Area 6: Testing Strategy with Vitest

### Decision
Use `vitest` for all TypeScript testing (unit and integration). Mock Python bridge calls in unit tests, use fixture datasets with real Python bridge for integration tests.

### Rationale
- Vitest is Vite-native, fastest test runner for TypeScript projects
- Built-in mocking, coverage, and watch mode
- Compatible with Jest API (easy migration path if needed)
- Supports both unit and integration testing in single framework

### Test Organization
```typescript
// Unit test example: Mock Python bridge
import { vi } from 'vitest';
import { KnowledgeStore } from '../src/store/knowledgeStore';

vi.mock('../src/bridge/pythonBridge', () => ({
  PythonBridge: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue([
      { score: 0.95, title: 'Doc 1', path: '/doc1.md', snippet: '...' }
    ])
  }))
}));

// Integration test example: Real Python bridge with fixtures
describe('MCP Client Integration', () => {
  it('should search test dataset via MCP protocol', async () => {
    const client = new MCPClient('node dist/cli.js --stdio');
    const result = await client.callTool('knowledge.search', {
      dataset: 'test-fixture',
      query: 'sample query',
      topK: 3
    });
    expect(result).toHaveLength(3);
  });
});
```

### Coverage Targets
- Unit tests: >80% line coverage (tools, config, bridge wrapper)
- Integration tests: All user scenarios from spec (P1, P2, P3)
- Edge cases: All 6 edge cases from spec must have test coverage

### Alternatives Considered
- **Jest**: Slower than vitest, more configuration, rejected for performance
- **Mocha + Chai**: Separate assertion library, more boilerplate, rejected for ergonomics
- **AVA**: Less mature ecosystem, rejected for community support

### Reference Materials
- Vitest documentation: https://vitest.dev/
- Vitest mocking guide: https://vitest.dev/guide/mocking.html

---

## Summary of Decisions

| Area | Technology/Pattern | Key Rationale |
|------|-------------------|---------------|
| MCP SDK | @modelcontextprotocol/sdk + Zod | Official SDK, type-safe, well-documented |
| Python Bridge | execa + connection pool | Reliable, performant, simple deployment |
| Manifest Validation | Zod schemas | Type safety + runtime validation in one |
| Logging | pino (JSON to stderr) | Fast, structured, integrates with log systems |
| Transport | stdio (MCP SDK built-in) | Standard for CLI-based MCP servers |
| Testing | vitest | Fast, modern, supports all test types |

All research areas have been resolved. No outstanding NEEDS CLARIFICATION items remain. Ready to proceed to Phase 1 (Design & Contracts).
