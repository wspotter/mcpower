# Implementation Plan: Core MCP Server with Knowledge Search

**Branch**: `001-mcp-server-core` | **Date**: 2025-11-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mcp-server-core/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement an MCP (Model Context Protocol) server that provides knowledge search capabilities over pre-built FAISS embeddings. The server exposes two primary tools (`knowledge.search` and `knowledge.listDatasets`) to MCP clients like VS Code Copilot and Cherry Studio. The implementation follows a bridge architecture where TypeScript handles MCP protocol communication and delegates vector search operations to a Python bridge that wraps existing FAISS/embedding infrastructure. The system supports multi-dataset registration via JSON manifests, concurrent client connections, and comprehensive observability through structured logging.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 18+), Python 3.10+  
**Primary Dependencies**: @modelcontextprotocol/sdk, zod (input validation), pino (logging), execa (Python bridge), dotenv (config); Python: typer (CLI), faiss-cpu (vector search), sentence-transformers (embeddings)  
**Storage**: File system (FAISS index files, JSON metadata, dataset manifests)  
**Testing**: vitest (TypeScript unit/integration), pytest (Python bridge)  
**Target Platform**: Linux server (primary), macOS (development), cross-platform Node.js runtime
**Project Type**: Single project (TypeScript MCP server with Python bridge subprocess)  
**Performance Goals**: <500ms p95 search latency, support 10+ concurrent clients, <5s startup time with 5 datasets  
**Constraints**: Must conform to MCP protocol specification, no FAISS reimplementation in TS, JSON-only manifest format, stdio transport for MCP communication  
**Scale/Scope**: 5-10 knowledge datasets initially, 10-50 concurrent clients, embedding indexes up to 100k documents per dataset

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. MCP Protocol Compliance
- **Status**: COMPLIANT
- **Evidence**: Feature spec requires strict MCP SDK usage (FR-010, FR-011), tool naming follows `namespace.action` convention (`knowledge.search`, `knowledge.listDatasets`)
- **Action**: None required

### ✅ II. Dataset Registry Contract
- **Status**: COMPLIANT
- **Evidence**: Feature spec mandates JSON manifests with required fields (FR-001), validation on startup (FR-002), unique alphanumeric IDs implied by FR-001
- **Action**: None required

### ✅ III. Bridge-Based Python Integration
- **Status**: COMPLIANT
- **Evidence**: Feature spec explicitly requires Python bridge delegation (FR-006), no FAISS reimplementation in TS, caching per dataset (FR-014)
- **Action**: None required

### ✅ IV. Observability and Logging
- **Status**: COMPLIANT
- **Evidence**: Feature spec requires structured JSON logging with specific fields (FR-007), startup diagnostics (FR-015), error logging with context (SC-003)
- **Action**: Ensure `--log-level` flag added to CLI during implementation

### ✅ V. Test Coverage and Validation
- **Status**: COMPLIANT
- **Evidence**: Constitution requires vitest/pytest, feature spec implies comprehensive testing through edge cases and acceptance scenarios
- **Action**: Test plan will be generated in tasks.md (Phase 2)

### ⚠️ VI. Versioning and Breaking Changes
- **Status**: PENDING
- **Evidence**: No version field in current scope, but initial v0.1.0 will be set during package.json creation
- **Action**: Add version field to package.json in Phase 1, document in quickstart.md

### ✅ VII. Simplicity and Minimalism
- **Status**: COMPLIANT
- **Evidence**: Feature scope tightly bounded to search operations only, excludes embedding generation (Assumptions section), minimal CLI flags expected
- **Action**: None required

**GATE RESULT**: ✅ PASS (1 pending item to address in Phase 1)

## Project Structure

### Documentation (this feature)

```text
specs/001-mcp-server-core/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── knowledge-search.json      # MCP tool schema for knowledge.search
│   └── knowledge-listDatasets.json # MCP tool schema for knowledge.listDatasets
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── server.ts           # MCP server initialization and tool registration
├── cli.ts              # CLI entry point (--stdio, --log-level, --datasets flags)
├── store/
│   └── knowledgeStore.ts  # TypeScript wrapper for Python bridge
├── bridge/
│   └── pythonBridge.ts    # Subprocess management for Python calls
├── tools/
│   ├── search.ts          # knowledge.search tool implementation
│   └── listDatasets.ts    # knowledge.listDatasets tool implementation
├── config/
│   └── datasets.ts        # Dataset manifest loading and validation
└── types/
    ├── dataset.ts         # Dataset and manifest type definitions
    └── searchResult.ts    # Search result type definitions

python/
├── bridge.py           # CLI bridge for FAISS operations
├── store.py            # KnowledgeStore class (reused from existing code)
└── requirements.txt    # Python dependencies

tests/
├── unit/
│   ├── tools/
│   │   ├── search.test.ts
│   │   └── listDatasets.test.ts
│   ├── config/
│   │   └── datasets.test.ts
│   └── bridge/
│       └── pythonBridge.test.ts
├── integration/
│   └── mcp-client.test.ts  # End-to-end MCP protocol tests
└── fixtures/
    └── test-dataset/       # Minimal dataset for testing
        ├── manifest.json
        ├── docs.index/
        └── metadata.json

datasets/               # Runtime dataset directory
└── .gitkeep           # Not tracked, populated by users

bin/
└── mcpower            # CLI wrapper script (shebang to node dist/cli.js)

dist/                  # Compiled TypeScript output (gitignored)

package.json           # Node.js project manifest
tsconfig.json          # TypeScript configuration
.env.example           # Environment variable template
README.md              # Project documentation
```

**Structure Decision**: Single project structure selected. The TypeScript MCP server is the primary deliverable with a Python bridge as a subprocess integration point (not a separate service). This aligns with the single-binary deployment model where `bin/mcpower` starts the Node.js process which spawns Python as needed. Tests are organized by type (unit/integration) with fixtures for dataset testing. The `datasets/` directory is runtime-only and not part of the repository (users provision their own embeddings).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations requiring justification. All core principles are satisfied by the feature design.

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion*

### ✅ I. MCP Protocol Compliance
- **Status**: COMPLIANT
- **Evidence**: Tool contracts (contracts/*.json) define proper MCP tool schemas, research.md confirms MCP SDK usage patterns with Zod validation
- **Design Impact**: Tool registration code in research.md aligns with MCP SDK best practices

### ✅ II. Dataset Registry Contract
- **Status**: COMPLIANT
- **Evidence**: data-model.md defines complete DatasetManifest schema with all required fields, validation rules documented
- **Design Impact**: Manifest schema in data-model.md matches constitution requirements exactly

### ✅ III. Bridge-Based Python Integration
- **Status**: COMPLIANT
- **Evidence**: research.md documents execa-based bridge pattern, data-model.md defines PythonBridgeRequest/Response types, no FAISS implementation in TS
- **Design Impact**: Bridge architecture fully specified, caching strategy documented

### ✅ IV. Observability and Logging
- **Status**: COMPLIANT
- **Evidence**: research.md specifies pino logger with JSON output, log events catalog defined, quickstart.md documents --log-level flag
- **Design Impact**: All logging requirements from constitution addressed in design

### ✅ V. Test Coverage and Validation
- **Status**: COMPLIANT
- **Evidence**: research.md defines vitest testing strategy with unit/integration split, coverage targets >80%, fixture datasets planned
- **Design Impact**: Test organization in project structure supports TDD workflow

### ✅ VI. Versioning and Breaking Changes
- **Status**: COMPLIANT (resolved)
- **Evidence**: quickstart.md documents v0.1.0 initial version, package.json will include version field
- **Design Impact**: Version management strategy documented, ready for implementation

### ✅ VII. Simplicity and Minimalism
- **Status**: COMPLIANT
- **Evidence**: Scope limited to search tools only (confirmed in contracts/), quickstart.md shows minimal CLI flags (--stdio, --datasets, --log-level)
- **Design Impact**: Design maintains focus on core search mission, no feature creep

**FINAL GATE RESULT**: ✅ PASS - All constitution principles satisfied by design

---

## Phase Summary

**Phase 0 (Research)**: ✅ Complete
- All technical unknowns resolved
- Technology stack decisions documented with rationale
- Alternatives evaluated and rejected for cause
- Output: research.md (6 research areas, 0 unresolved items)

**Phase 1 (Design & Contracts)**: ✅ Complete
- Data model defined with 6 core entities
- MCP tool contracts created (knowledge.search, knowledge.listDatasets)
- Quickstart guide written for end users
- Agent context updated (GitHub Copilot)
- Output: data-model.md, contracts/*.json, quickstart.md, .github/copilot-instructions.md

**Phase 2 (Tasks)**: 🔄 Ready to begin
- Run `/speckit.tasks` to generate task breakdown
- Tasks will be organized by user story (P1, P2, P3)
- Expected output: tasks.md with test-first task ordering

**Next Command**: `/speckit.tasks`
