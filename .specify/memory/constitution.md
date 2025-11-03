<!--
Sync Impact Report:
Version: 0.0.0 → 1.0.0
Changes:
  - Initial constitution creation for mcpower (Knowledge MCP Server)
  - Established 7 core principles for MCP server development
  - Defined technical standards and quality gates
  - Added development workflow and governance rules
Templates Status:
  ✅ plan-template.md - Constitution Check section aligns with principles
  ✅ spec-template.md - User story structure and requirements align with principles
  ✅ tasks-template.md - Task organization and testing approach align with principles
Follow-up TODOs:
  - None (all placeholders filled)
-->

# mcpower Constitution

## Core Principles

### I. MCP Protocol Compliance

The server MUST strictly adhere to the Model Context Protocol specification. All tool
registrations, input schemas (using Zod), and response formats MUST conform to the MCP SDK
contracts. Tools MUST be named following the `namespace.action` convention (e.g.,
`knowledge.search`, `knowledge.listDatasets`). Error handling MUST use MCP-standard error codes
and messages.

**Rationale**: MCP compliance ensures interoperability with clients like VS Code Copilot, Cherry
Studio, and other MCP-aware applications. Non-compliant implementations break client integrations.

### II. Dataset Registry Contract

Every knowledge dataset MUST be registered via a JSON manifest containing: `id`, `name`,
`description`, `index` (path to FAISS index directory), `metadata` (path to metadata JSON), and
`defaultTopK`. The server MUST validate manifest completeness on startup and reject datasets with
missing or invalid manifests. Dataset IDs MUST be unique and alphanumeric with hyphens only.

**Rationale**: Explicit manifests enable multi-dataset management, clear ownership, and
self-documenting configuration. They prevent runtime failures from malformed or incomplete dataset
registrations.

### III. Bridge-Based Python Integration

TypeScript code MUST NOT reimplement FAISS or embedding logic. All embedding operations MUST be
delegated to a Python bridge (`python/bridge.py`) that wraps the existing `KnowledgeStore` class.
The bridge MUST accept CLI arguments (`--index`, `--query`, `--k`) and output JSON to stdout,
errors to stderr. The TypeScript layer caches `KnowledgeStore` instances per dataset ID to avoid
repeated Python process spawns.

**Rationale**: Reusing proven Python code avoids duplication, leverages mature FAISS bindings, and
reduces TypeScript complexity. The bridge pattern isolates language boundaries cleanly.

### IV. Observability and Logging

All MCP tool invocations MUST be logged using `pino` with structured JSON output including:
timestamp, tool name, dataset ID, query (sanitized if sensitive), result count, and latency. Error
paths MUST log stack traces and context. The CLI MUST support a `--log-level` flag (default:
`info`). Health checks and startup diagnostics MUST be logged at `info` level.

**Rationale**: Structured logs enable production debugging, performance analysis, and audit trails.
JSON output integrates with log aggregation systems (e.g., ELK, Loki).

### V. Test Coverage and Validation

Unit tests MUST cover tool input validation (unknown dataset IDs, empty queries, invalid `topK`
values) and mock Python bridge responses. Integration tests MUST use fixture datasets (minimal
index + metadata stubs) and verify end-to-end search flows via the MCP client SDK. CLI tests MUST
verify `--stdio` and error handling. Tests run via `vitest` and MUST pass before merging.

**Rationale**: MCP servers operate in diverse client environments. Comprehensive testing prevents
integration failures and ensures reliability across Copilot, Cherry Studio, and other clients.

### VI. Versioning and Breaking Changes

The server follows semantic versioning (`MAJOR.MINOR.PATCH`). MAJOR version bumps for breaking
changes to manifest schema, tool contracts, or Python bridge API. MINOR for new tools or backward-
compatible features. PATCH for bug fixes and documentation. The MCP server `version` field MUST
match `package.json` version. Migration guides MUST accompany MAJOR version releases.

**Rationale**: Semantic versioning communicates impact to downstream users. Clear migration paths
reduce friction during upgrades and maintain trust in the project.

### VII. Simplicity and Minimalism

The server MUST remain focused on its core mission: knowledge search over pre-built embeddings. Do
NOT add features unrelated to search (e.g., embedding generation, document parsing, user auth). CLI
flags MUST be minimal and well-documented. Default configurations MUST work out-of-the-box for
common use cases. Avoid premature optimization—measure first, optimize if proven necessary.

**Rationale**: Feature creep increases complexity, maintenance burden, and attack surface.
Simplicity ensures the server is understandable, auditable, and reliable.

## Technical Standards

**Language**: TypeScript (Node.js 18+), Python 3.10+ for bridge  
**Primary Dependencies**: `@modelcontextprotocol/sdk`, `zod`, `pino`, `execa` (TS); `typer`,
`faiss-cpu`, `sentence-transformers` (Python)  
**Testing**: `vitest` for TS, `pytest` for Python bridge  
**Code Style**: ESLint + Prettier (TS), Black + isort (Python)  
**Performance Goals**: Search latency <500ms p95, support 10+ concurrent clients  
**Distribution**: npm package with compiled `dist/` output, optional Docker image

## Development Workflow

**Specification First**: Every feature MUST start with a spec in `/specs/###-feature-name/spec.md`
following the spec-template. User stories MUST be prioritized (P1, P2, P3) and independently
testable.

**Test-Driven Development**: Tests MUST be written first (Red), verified to fail, then
implementation proceeds (Green), followed by refactoring. All tests MUST pass before committing.

**Code Review Gates**: PRs MUST include: (1) tests passing, (2) no linting errors, (3) updated
documentation if user-facing changes, (4) changelog entry for MINOR/MAJOR changes. Reviews verify
constitution compliance.

**Documentation**: README MUST include quickstart, tool contracts, and manifest schema. `/docs/`
MUST contain usage guides, integration examples (VS Code, Cherry Studio), and troubleshooting.

## Governance

This constitution supersedes all other development practices. Amendments require:

1. Documented rationale (why the change is necessary)
2. Impact assessment on existing code and templates
3. Approval via PR review
4. Version bump following semantic versioning (MAJOR for principle removal/redefinition, MINOR for
   additions, PATCH for clarifications)
5. Migration plan for MAJOR changes

All PRs MUST verify compliance with this constitution. Violations MUST be justified in plan.md's
Complexity Tracking section and approved before merging. The constitution applies to all code,
documentation, and tooling in this repository.

**Version**: 1.0.0 | **Ratified**: 2025-11-02 | **Last Amended**: 2025-11-02
