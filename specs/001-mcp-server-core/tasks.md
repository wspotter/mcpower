# Tasks: Core MCP Server with Knowledge Search

**Input**: Design documents from `/specs/001-mcp-server-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included per constitution principle V (Test Coverage and Validation)
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `python/`, `tests/` at repository root per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directory structure: `src/`, `src/tools/`, `src/store/`, `src/bridge/`, `src/config/`, `src/types/`, `python/`, `tests/`, `tests/unit/`, `tests/integration/`, `datasets/`
- [X] T002 Initialize TypeScript project: `npm init -y`, install dependencies (@modelcontextprotocol/sdk, zod, pino, execa, dotenv), dev dependencies (vitest, @types/node, typescript)
- [X] T003 [P] Create `tsconfig.json` with ES2022 target, Node18 lib, strict mode, moduleResolution: "node16"
- [X] T004 [P] Create `vitest.config.ts` with test environment configuration
- [X] T005 [P] Initialize Python project: create `python/requirements.txt` with faiss-cpu, sentence-transformers, typer dependencies
- [X] T006 [P] Add npm scripts to `package.json`: "build", "dev", "test", "lint"
- [X] T007 [P] Create `.gitignore` excluding `node_modules/`, `dist/`, `*.log`, `.env`, `datasets/*/docs.index`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Create `src/types/dataset.ts` with Dataset interface and DatasetManifestSchema (Zod) per data-model.md Entity 1 & 2
- [X] T009 [P] Create `src/types/searchResult.ts` with SearchResult interface and SearchResultSchema (Zod) per data-model.md Entity 3
- [X] T010 [P] Create `src/types/searchQuery.ts` with SearchQuery interface per data-model.md Entity 4
- [X] T011 Create `src/config/datasets.ts` implementing DatasetRegistry per data-model.md Entity 5: scan `datasets/` directory, parse manifest.json files, validate with Zod, handle errors gracefully
- [X] T012 Create `python/bridge.py` with Typer CLI: subcommands for `search`, `validate-index`, `health-check` (FR-006)
- [X] T013 [P] Create `src/bridge/pythonBridge.ts` implementing PythonBridgeRequest per data-model.md Entity 6: use execa to spawn python/bridge.py, parse JSON output, handle timeouts (10s), implement error handling
- [X] T014 Create `src/store/knowledgeStore.ts` caching KnowledgeStore instances per dataset (Constitution III), wrapping Python bridge calls with connection pooling
- [X] T015 Configure Pino logger in `src/logger.ts` with structured JSON output to stderr, log levels (debug, info, warn, error), include timestamp, requestId, tool name fields (FR-007)
- [X] T016 Create `src/cli.ts` entry point with CLI flags: `--stdio` (MCP transport), `--log-level` (debug/info/warn/error), `--datasets` (path to datasets directory, default: "./datasets")
- [X] T017 Create `src/server.ts` initializing MCP Server with stdio transport, loading datasets via DatasetRegistry, registering empty tool handlers (will be filled in Phase 3+)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Search Knowledge Dataset (Priority: P1) 🎯 MVP

**Goal**: Implement semantic search over knowledge datasets, returning relevant results with scores, titles, paths, and snippets

**Independent Test**: Connect MCP client to server via stdio, invoke `knowledge.search` with dataset="cherry-docs" and query="installation steps", verify results array with scores/titles/paths/snippets returned

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T018 [P] [US1] Create `tests/unit/tools/search.test.ts` testing SearchInputSchema validation: valid inputs pass, missing query fails, invalid topK fails, unknown dataset fails
- [X] T019 [P] [US1] Create `tests/unit/store/knowledgeStore.test.ts` testing search result mapping: Python bridge output → SearchResult objects, score normalization, snippet truncation
- [X] T020 [US1] Create `tests/integration/search.test.ts` testing end-to-end search: load test dataset manifest, invoke knowledge.search tool, verify result structure matches contract (FR-004)

### Implementation for User Story 1

- [X] T021 [US1] Implement `python/bridge.py search` command: load FAISS index from path, encode query using sentence-transformers, execute similarity search, return JSON with scores/metadata (FR-006)
- [X] T022 [US1] Implement `src/tools/search.ts`: define SearchInputSchema (Zod) from contracts/knowledge-search.json, implement tool handler calling knowledgeStore.search(), format results per contract response schema
- [X] T023 [US1] Register `knowledge.search` tool in `src/server.ts` using server.tool() with SearchInputSchema and search.ts handler
- [X] T024 [US1] Add input validation in `src/tools/search.ts`: trim whitespace from query, validate dataset exists in registry, clamp topK to 1-100 range, return validation errors per contract error codes (FR-008)
- [X] T025 [US1] Implement search logging in `src/tools/search.ts`: log tool invocation with dataset ID, query (sanitized/truncated), result count, latency in ms, error details if failed (FR-007)
- [X] T026 [US1] Add error handling for Python bridge failures in `src/store/knowledgeStore.ts`: catch execa errors, log stack trace, return SERVICE_UNAVAILABLE error per contract, implement retry logic (1 retry with 1s delay) (FR-009)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently ✅

---

## Phase 4: User Story 2 - Discover Available Datasets (Priority: P2)

**Goal**: Enable users to list all registered datasets with metadata, improving discoverability and usability

**Independent Test**: Connect MCP client to server, invoke `knowledge.listDatasets` with no parameters, verify datasets array returned with id/name/description/defaultTopK/status fields

### Tests for User Story 2

- [X] T027 [P] [US2] Create `tests/unit/tools/listDatasets.test.ts` testing dataset filtering: ready datasets included, error datasets excluded, empty registry returns empty array
- [X] T028 [P] [US2] Create `tests/integration/listDatasets.test.ts` testing end-to-end listing: load multiple test manifests, invoke knowledge.listDatasets, verify all ready datasets returned with correct metadata

### Implementation for User Story 2

- [X] T029 [US2] Implement `src/tools/listDatasets.ts`: define ListDatasetsInputSchema (empty object per contract), implement handler querying DatasetRegistry.getAll(), filter by status="ready", format response per contracts/knowledge-listDatasets.json
- [X] T030 [US2] Register `knowledge.listDatasets` tool in `src/server.ts` using server.tool() with empty input schema and listDatasets.ts handler
- [X] T031 [US2] Add metadata calculation in `src/tools/listDatasets.ts`: count total/ready/error datasets, include in response.metadata per contract (FR-005)
- [X] T032 [US2] Add logging for listDatasets invocations in `src/tools/listDatasets.ts`: log tool name, dataset count, latency in ms (FR-007)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently ✅

---

## Phase 5: User Story 3 - Server Health Monitoring (Priority: P3)

**Goal**: Provide visibility into server status and dataset health for administrators and monitoring systems

**Independent Test**: Start server with `--log-level=debug`, examine startup logs for version/loaded dataset count/ready status, verify error logs for invalid manifests

### Tests for User Story 3

- [X] T033 [P] [US3] Create `tests/unit/config/datasets.test.ts` testing manifest validation: valid manifest loads successfully, missing required fields logs error, invalid index path logs error, server continues with remaining datasets
- [X] T034 [P] [US3] Create `tests/integration/startup.test.ts` testing server initialization: start server programmatically, capture logs, verify startup log structure (version, dataset count, ready status per FR-015)

### Implementation for User Story 3

- [X] T035 [US3] Add startup logging in `src/server.ts`: log server version (from package.json), total datasets loaded, ready datasets count, error datasets count, timestamp, operational status="ready" (FR-015)
- [X] T036 [US3] Enhance dataset error logging in `src/config/datasets.ts`: log dataset ID, manifest path, validation error details, file system errors (missing index/metadata) with full paths (SC-003)
- [X] T037 [US3] Implement `python/bridge.py validate-index` command: check FAISS index files exist and are readable, return JSON with status="ok" or status="error" with details
- [X] T038 [US3] Add dataset validation on startup in `src/config/datasets.ts`: call Python bridge validate-index for each dataset, mark dataset status="error" if validation fails, continue loading other datasets (per User Story 3 Acceptance Scenario 2)

**Checkpoint**: All user stories should now be independently functional ✅

**Phase 5 Completion Notes**:
- All 62 tests passing (51 existing + 9 new startup tests + 2 additional dataset tests)
- Enhanced startup logging with dynamic version from package.json, platform/node info, operational status='ready'
- Python validate-index enhanced with FAISS property inspection (is_trained, ntotal, d)
- Error logging includes full paths, error types, dataset context per SC-003
- Dataset validation integrated with graceful degradation on startup
- Test Results: T033 (11 unit tests), T034 (9 integration tests), all passing

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T039 [P] Create sample dataset in `datasets/sample-docs/`: manifest.json, placeholder index files, metadata.json with 3-5 sample documents
- [ ] T040 [P] Create `README.md` in repository root: project overview, quick start (link to quickstart.md), architecture diagram (TypeScript ↔ Python bridge), MCP client setup links
- [ ] T041 [P] Validate `specs/001-mcp-server-core/quickstart.md` steps: follow guide end-to-end, test with Cherry Studio or VS Code, document any issues
- [ ] T042 Create `examples/` directory with example queries for sample dataset, example MCP client configuration (VS Code settings.json, Cherry Studio config)
- [ ] T043 [P] Add unit tests for edge cases in `tests/unit/`: empty query string, whitespace-only query, topK=0, topK=101, dataset ID with uppercase letters, concurrent searches
- [ ] T044 Performance testing: measure p95 search latency (<500ms per plan.md), test 10 concurrent clients, measure startup time with 5 datasets (<5s)
- [ ] T045 [P] Code cleanup: add JSDoc comments to exported functions, remove debug console.log statements, ensure consistent error message formats
- [ ] T046 Security hardening: sanitize query strings in logs (truncate to 100 chars, redact sensitive patterns), validate manifest JSON file sizes (<10KB), limit datasets directory recursion depth
- [ ] T047 [P] Update version to v0.1.0 in `package.json` (Constitution VI compliance)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational (Phase 2) completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories - **This is the MVP**
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 (queries different data from registry)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2 (enhances startup/logging only)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- US1: T018-T020 (tests) → T021 (Python bridge) → T022-T023 (tool registration) → T024-T026 (validation/logging/errors)
- US2: T027-T028 (tests) → T029-T030 (tool implementation) → T031-T032 (metadata/logging)
- US3: T033-T034 (tests) → T035-T036 (logging enhancements) → T037-T038 (validation integration)

### Parallel Opportunities

- **Setup (Phase 1)**: T003, T004, T005, T006, T007 can run in parallel
- **Foundational (Phase 2)**: T009, T010 can run in parallel; T012, T013 can run in parallel
- **User Story 1 Tests**: T018, T019 can run in parallel (different files)
- **User Story 2 Tests**: T027, T028 can run in parallel
- **User Story 3 Tests**: T033, T034 can run in parallel
- **Polish (Phase 6)**: T039, T040, T041, T043, T045, T047 can run in parallel
- **All user stories** (Phase 3-5) can be worked on in parallel by different team members after Phase 2 completes

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T018: "Create tests/unit/tools/search.test.ts testing SearchInputSchema validation"
Task T019: "Create tests/unit/store/knowledgeStore.test.ts testing search result mapping"

# These can run simultaneously as they target different files
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T017) - **CRITICAL checkpoint**
3. Complete Phase 3: User Story 1 (T018-T026)
4. **STOP and VALIDATE**: Test knowledge.search independently with MCP client
5. Deploy/demo if ready - **This is the minimum viable product**

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (Tasks: T001-T017)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (Tasks: T018-T026)
3. Add User Story 2 → Test independently → Deploy/Demo (Tasks: T027-T032)
4. Add User Story 3 → Test independently → Deploy/Demo (Tasks: T033-T038)
5. Polish (Tasks: T039-T047)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T017)
2. Once Foundational is done:
   - Developer A: User Story 1 (T018-T026)
   - Developer B: User Story 2 (T027-T032)
   - Developer C: User Story 3 (T033-T038)
3. Stories complete and integrate independently
4. Team reconvenes for Polish (T039-T047)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD per constitution principle V)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution compliance verified in plan.md - all principles addressed
- Priority order: P1 (Search - MVP) → P2 (Discovery) → P3 (Monitoring)
