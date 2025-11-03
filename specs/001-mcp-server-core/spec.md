# Feature Specification: Core MCP Server with Knowledge Search

**Feature Branch**: `001-mcp-server-core`  
**Created**: 2025-11-02  
**Status**: Draft  
**Input**: User description: "Implement the core MCP server with knowledge search tools"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search Knowledge Dataset (Priority: P1)

A developer using VS Code Copilot or Cherry Studio wants to search documentation embeddings to get relevant context for their queries. They connect to the MCP server through their client application and issue search queries against registered knowledge datasets.

**Why this priority**: This is the core value proposition of the entire system. Without the ability to search knowledge datasets, the server provides no functionality. This is the minimum viable product.

**Independent Test**: Can be fully tested by connecting an MCP client to the server, invoking the `knowledge.search` tool with a query string and dataset ID, and verifying that relevant results with snippets and attribution are returned.

**Acceptance Scenarios**:

1. **Given** a knowledge dataset is registered with embeddings, **When** a user searches with a query string, **Then** the system returns top-k relevant results with scores, titles, paths, and text snippets
2. **Given** multiple datasets are registered, **When** a user specifies a dataset ID in their search, **Then** results come only from that specific dataset
3. **Given** a search query is executed, **When** results are returned, **Then** each result includes attribution (source document, path) for proper citation

---

### User Story 2 - Discover Available Datasets (Priority: P2)

A developer wants to understand what knowledge sources are available before searching. They need to list all registered datasets with their descriptions and capabilities.

**Why this priority**: Users need to know what datasets exist before they can search them. This is essential for usability but the server could technically function with hardcoded dataset IDs (P1 only). This enables self-discovery and better user experience.

**Independent Test**: Can be fully tested by connecting an MCP client and invoking the `knowledge.listDatasets` tool, then verifying that all registered datasets are returned with their metadata (name, description, default search parameters).

**Acceptance Scenarios**:

1. **Given** datasets are registered via manifest files, **When** a user lists available datasets, **Then** all valid datasets are returned with their IDs, names, and descriptions
2. **Given** a dataset manifest is invalid or missing required fields, **When** datasets are listed, **Then** that dataset is excluded from results and an error is logged
3. **Given** no datasets are registered, **When** a user lists datasets, **Then** an empty list is returned without error

---

### User Story 3 - Server Health Monitoring (Priority: P3)

An administrator or monitoring system wants to verify the MCP server is running correctly and all configured datasets loaded successfully. They need visibility into server status and dataset health.

**Why this priority**: While important for production operations, the core search functionality works without explicit health checks. This is a quality-of-life feature for operations teams but not required for basic functionality.

**Independent Test**: Can be fully tested by starting the server and examining startup logs, then optionally invoking a health check endpoint or tool that reports server status and loaded dataset counts.

**Acceptance Scenarios**:

1. **Given** the server starts successfully, **When** initialization completes, **Then** structured logs confirm the server version, loaded datasets count, and ready status
2. **Given** a dataset fails to load due to missing index files, **When** the server starts, **Then** an error is logged with the dataset ID and reason, but the server continues running with remaining datasets
3. **Given** the server is running, **When** a health check is requested, **Then** the response includes uptime, dataset count, and operational status

---

### Edge Cases

- What happens when a user searches with an unknown dataset ID? → Return clear error message indicating dataset not found, list available dataset IDs
- What happens when embedding index files are corrupted or unreadable? → Log detailed error with file paths, exclude dataset from availability, continue serving other datasets
- What happens when a search query is empty or only whitespace? → Return validation error before calling Python bridge
- What happens when Python bridge process fails or times out? → Log error with stack trace, return service unavailable error to client, implement retry logic for transient failures
- What happens when multiple clients search simultaneously? → Server must handle concurrent requests without blocking, respect performance targets (<500ms p95)
- What happens when topK parameter is invalid (negative, zero, or unreasonably large)? → Validate and reject with error message, or clamp to reasonable bounds (1-100)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST register knowledge datasets via JSON manifest files containing dataset ID, name, description, index path, metadata path, and default topK value
- **FR-002**: System MUST validate all dataset manifests on startup and reject datasets with missing required fields or invalid paths
- **FR-003**: System MUST provide a `knowledge.search` tool accepting dataset ID, query string, and optional topK parameter
- **FR-004**: System MUST return search results containing relevance score, document title, document path, and text snippet for each match
- **FR-005**: System MUST provide a `knowledge.listDatasets` tool returning all successfully loaded datasets with their metadata
- **FR-006**: System MUST delegate all embedding operations to a Python bridge process to avoid reimplementing vector search logic
- **FR-007**: System MUST log all tool invocations with structured JSON output including timestamp, tool name, dataset ID, query (sanitized), result count, and latency
- **FR-008**: System MUST validate input parameters (non-empty queries, valid dataset IDs, reasonable topK values) before processing
- **FR-009**: System MUST handle Python bridge failures gracefully with appropriate error messages and retry logic
- **FR-010**: System MUST conform to Model Context Protocol specification for tool registration, input schemas, and response formats
- **FR-011**: System MUST use standard MCP error codes and messages for all error conditions
- **FR-012**: System MUST support concurrent client connections without blocking or performance degradation
- **FR-013**: System MUST initialize on startup by discovering and loading all dataset manifests from a configured directory
- **FR-014**: System MUST cache embedding store instances per dataset to avoid repeated initialization overhead
- **FR-015**: System MUST provide startup diagnostics in logs indicating server version, loaded dataset count, and any initialization errors

### Key Entities

- **Dataset**: Represents a collection of embedded documents with a unique identifier, descriptive name, description text, file system paths to index and metadata files, and default search parameters
- **Search Result**: Contains relevance score (numeric), document title (string), document path (string for citation), and text snippet (string excerpt from matched content)
- **Dataset Manifest**: JSON configuration file defining dataset registration with required fields for identification and file paths
- **Search Query**: User input consisting of dataset identifier, natural language query text, and optional result count parameter

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users receive search results in under 500 milliseconds for 95% of queries (p95 latency)
- **SC-002**: Server successfully handles 10 concurrent client connections without latency degradation beyond performance targets
- **SC-003**: All dataset loading errors are captured in structured logs with sufficient detail for troubleshooting (file paths, error types, stack traces)
- **SC-004**: Search results include attribution (source path) in 100% of responses to enable proper citation
- **SC-005**: Invalid requests (unknown datasets, empty queries, invalid parameters) return clear error messages that enable users to correct their input without consulting documentation
- **SC-006**: Server startup completes and reports ready status in under 5 seconds with up to 5 registered datasets
- **SC-007**: Dataset manifests with missing required fields are rejected at startup with zero impact on other valid datasets (graceful degradation)

## Assumptions

- Pre-built FAISS embeddings already exist and are generated by separate tooling (not part of this feature)
- Python 3.10+ runtime with `faiss-cpu`, `sentence-transformers`, and required dependencies is available on the system PATH
- Dataset manifest files follow a standard JSON schema and are placed in a known directory structure
- MCP client applications (VS Code Copilot, Cherry Studio) handle MCP protocol communication and require no server-side client implementation
- Embedding model dimensions and similarity metrics are consistent within each dataset (determined during embedding generation)
- Network latency between client and server is negligible for local or LAN deployments
- File system provides sufficient IOPS for concurrent index file reads during multi-client search operations
- Error logging is sufficient for operations; real-time alerting/monitoring is handled by external systems
