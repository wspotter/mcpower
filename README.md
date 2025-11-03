# MCP Power - Knowledge Search Server

A Model Context Protocol (MCP) server that provides semantic search capabilities over knowledge datasets using FAISS vector embeddings.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/tests-86%20passing-brightgreen)](tests/)

## 🚀 Features

- **Semantic Search**: Search knowledge datasets using natural language queries
- **Multiple Datasets**: Manage and search across multiple knowledge bases
- **MCP Compatible**: Works with any MCP client (VS Code, Cherry Studio, etc.)
- **Fast & Reliable**: FAISS-powered vector search with <500ms p95 latency
- **Graceful Degradation**: Continues working even with invalid datasets
- **Comprehensive Logging**: Structured JSON logs with detailed diagnostics

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Dataset Management](#dataset-management)
- [MCP Tools](#mcp-tools)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## ⚡ Quick Start

See [Quick Start Guide](specs/001-mcp-server-core/quickstart.md) for detailed setup instructions.

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd python
pip install -r requirements.txt
```

### 2. Try the Sample Dataset

```bash
# Build the server
npm run build

# Start the server with the sample dataset
npm run dev -- --datasets ./datasets
```

### 3. Search from Your MCP Client

```json
{
  "tool": "knowledge.search",
  "arguments": {
    "dataset": "sample-docs",
    "query": "How do I get started?",
    "topK": 5
  }
}
```

## 🏗️ Architecture

```
┌─────────────────┐
│   MCP Client    │  (VS Code, Cherry Studio, etc.)
│  (TypeScript)   │
└────────┬────────┘
         │ MCP Protocol (stdio)
         │
┌────────┴────────┐
│   MCP Server    │
│  (TypeScript)   │
│                 │
│  ┌───────────┐  │
│  │  Dataset  │  │  Manages dataset registry
│  │ Registry  │  │  and configuration
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │ Knowledge │  │  Caches search instances
│  │   Store   │  │  per dataset
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │  Python   │  │  Spawns Python processes
│  │  Bridge   │  │  for FAISS operations
│  └─────┬─────┘  │
└────────┼────────┘
         │ execa (JSON over stdio)
         │
┌────────┴────────┐
│ Python Bridge   │
│   (Python)      │
│                 │
│  ┌───────────┐  │
│  │   FAISS   │  │  Vector search
│  │   Index   │  │  
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │ Sentence  │  │  Query encoding
│  │Transformers│  │  
│  └───────────┘  │
└─────────────────┘
```

## 📦 Installation

### Prerequisites

- **Node.js**: 18.x or higher
- **Python**: 3.10 or higher
- **npm**: 9.x or higher

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/mcpower.git
cd mcpower

# Install dependencies
npm install
cd python && pip install -r requirements.txt && cd ..

# Build
npm run build

# Optional: Link globally
npm link
```

### Verify Installation

```bash
npm run dev -- --version
# Output: Starting MCP Knowledge Server v0.1.0...
```

## ⚙️ Configuration

### Command Line Options

```bash
npm run dev -- [options]
```

Options:
- `--datasets <path>`: Path to datasets directory (default: `./datasets`)
- `--log-level <level>`: Log level: debug, info, warn, error (default: `info`)
- `--version`: Show version information

### Environment Variables

Create a `.env` file in the project root:

```env
# Datasets directory path
DATASETS_PATH=./datasets

# Log level (debug, info, warn, error)
LOG_LEVEL=info
```

## 📚 Dataset Management

### Dataset Structure

Each dataset requires three components:

```
datasets/
└── your-dataset/
    ├── manifest.json     # Configuration
    ├── metadata.json     # Document metadata
    └── index/           # FAISS index directory
        └── docs.index   # FAISS index file
```

### Manifest Format

`manifest.json`:
```json
{
  "id": "your-dataset",
  "name": "Your Dataset Name",
  "description": "Description of your dataset",
  "index": "index",
  "metadata": "metadata.json",
  "defaultTopK": 5
}
```

### Metadata Format

`metadata.json`:
```json
[
  {
    "id": "doc-1",
    "title": "Document Title",
    "path": "path/to/document.md",
    "content": "Full document content...",
    "snippet": "Short excerpt..."
  }
]
```

### Creating a Dataset

See the [sample dataset](datasets/sample-docs/) for a complete example.

To create embeddings from your documents, use a tool like:
- [sentence-transformers](https://www.sbert.net/)
- FAISS for indexing
- Custom embedding pipeline

## 🔧 MCP Tools

### knowledge.search

Search a knowledge dataset using natural language queries.

**Input Schema:**
```typescript
{
  dataset: string;    // Dataset ID (required)
  query: string;      // Search query (required)
  topK?: number;      // Number of results (optional, default: dataset's defaultTopK)
}
```

**Output:**
```typescript
{
  results: Array<{
    score: number;      // Similarity score (0-1)
    title: string;      // Document title
    path: string;       // Document path
    snippet: string;    // Text excerpt
  }>
}
```

**Example:**
```json
{
  "tool": "knowledge.search",
  "arguments": {
    "dataset": "sample-docs",
    "query": "how to configure datasets",
    "topK": 3
  }
}
```

### knowledge.listDatasets

List all available datasets with metadata.

**Input Schema:**
```typescript
{}  // No parameters required
```

**Output:**
```typescript
{
  datasets: Array<{
    id: string;
    name: string;
    description: string;
    defaultTopK: number;
  }>,
  metadata: {
    total: number;      // Total datasets
    ready: number;      // Ready datasets
    errors: number;     // Datasets with errors
  }
}
```

## 🛠️ Development

### Project Structure

```
mcpower/
├── src/                 # TypeScript source
│   ├── server.ts       # MCP server implementation
│   ├── cli.ts          # CLI entry point
│   ├── bridge/         # Python bridge
│   ├── config/         # Dataset registry
│   ├── store/          # Knowledge store
│   ├── tools/          # MCP tool implementations
│   └── types/          # TypeScript types
├── python/              # Python bridge
│   ├── bridge.py       # CLI for FAISS operations
│   └── requirements.txt
├── tests/               # Test suites
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
├── datasets/            # Knowledge datasets
│   └── sample-docs/    # Sample dataset
└── specs/               # Design documents
```

### Development Scripts

```bash
# Development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run lint
```

### Adding a New Dataset

1. Create dataset directory: `datasets/your-dataset/`
2. Add `manifest.json` with dataset configuration
3. Add `metadata.json` with document metadata
4. Add FAISS index in `index/` directory
5. Restart the server

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test tests/unit/tools/search.test.ts
```

### Test Coverage

Current test coverage: **86 tests passing**
- 18 search edge case tests (Phase 6)
- 15 search tool tests
- 11 dataset registry tests
- 9 listDatasets tests
- 9 startup integration tests
- 8 knowledge store tests
- 6 performance tests (Phase 6)
- 5 listDatasets integration tests
- 5 search integration tests

## 🐛 Troubleshooting

### Dataset Not Found

**Error**: `Dataset not found: your-dataset`

**Solutions**:
- Verify the dataset ID in manifest.json matches the query
- Check that manifest.json is in the datasets directory
- Restart the server to reload dataset registry

### Python Bridge Failures

**Error**: `Python bridge command failed`

**Solutions**:
- Ensure Python 3.10+ is installed and in PATH
- Install Python dependencies: `pip install -r python/requirements.txt`
- Check that FAISS is installed: `python -c "import faiss"`

### Slow Search Performance

**Issue**: Search takes >500ms

**Solutions**:
- Check FAISS index size (smaller is faster)
- Ensure index is trained: `python python/bridge.py validate-index <path>`
- Consider using a GPU-accelerated FAISS build
- Reduce topK parameter

### Dataset Loading Errors

Check startup logs for detailed error messages:

```bash
npm run dev -- --log-level=debug
```

Look for error logs with:
- `manifestPath`: Location of problematic manifest
- `errorType`: Type of error (json_parse_error, file_not_found, validation_error)
- `error`: Detailed error message

## 📝 License

ISC

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

## 🔗 Links

- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [Quick Start Guide](specs/001-mcp-server-core/quickstart.md)
- [API Documentation](specs/001-mcp-server-core/contracts/)
- [Design Documents](specs/001-mcp-server-core/)

## 📊 Project Status

- ✅ Phase 1-5: Complete (All user stories implemented)
- 🚧 Phase 6: Polish & documentation (in progress)

---

**Made with ❤️ for the MCP community**
