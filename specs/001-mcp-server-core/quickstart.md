# Quickstart Guide: Core MCP Server with Knowledge Search

**Feature**: 001-mcp-server-core  
**Last Updated**: 2025-11-02  
**Target Audience**: Developers integrating the MCP server

## Overview

This guide walks you through setting up and using the mcpower MCP knowledge search server. You'll learn how to register datasets, start the server, and perform searches from MCP clients like VS Code Copilot.

**Prerequisites**:
- Node.js 18+ installed
- Python 3.10+ with `faiss-cpu`, `sentence-transformers` installed
- Pre-built FAISS embeddings (see "Preparing Datasets" section)
- Basic familiarity with command-line tools

**Time to Complete**: 10-15 minutes

---

## Step 1: Install the Server

### Option A: From npm (once published)
```bash
npm install -g mcpower
```

### Option B: From source (development)
```bash
git clone https://github.com/yourusername/mcpower.git
cd mcpower
npm install
npm run build
npm link  # Makes 'mcpower' command available globally
```

**Verify Installation**:
```bash
mcpower --version
# Expected output: mcpower v0.1.0
```

---

## Step 2: Prepare Your Dataset

### Dataset Requirements
Each knowledge dataset needs:
1. **FAISS Index**: Directory containing `.faiss` or `.index` files
2. **Metadata JSON**: File mapping document IDs to titles, paths, and text
3. **Manifest JSON**: Configuration file registering the dataset

### Example Dataset Structure
```
datasets/
└── cherry-docs/
    ├── manifest.json         # Dataset configuration
    ├── docs.index/           # FAISS index directory
    │   ├── index.faiss
    │   └── index_metadata.pkl
    └── metadata.json         # Document metadata
```

### Create a Manifest File

Create `datasets/cherry-docs/manifest.json`:
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

**Manifest Fields**:
- `id`: Unique identifier (lowercase, alphanumeric, hyphens only)
- `name`: Human-readable name for display
- `description`: Brief description of contents
- `index`: Path to FAISS index directory (relative or absolute)
- `metadata`: Path to metadata JSON file
- `defaultTopK`: Default number of search results (1-100)

### Metadata JSON Format
Your `metadata.json` should contain document information:
```json
{
  "documents": [
    {
      "id": "doc_001",
      "title": "Installation Guide",
      "path": "docs/getting-started/installation.md",
      "text": "Full document text content..."
    },
    {
      "id": "doc_002",
      "title": "Configuration",
      "path": "docs/getting-started/configuration.md",
      "text": "Full document text content..."
    }
  ]
}
```

**Note**: If you already have FAISS embeddings from another tool, adapt your metadata structure to match this format or modify the Python bridge to handle your existing format.

---

## Step 3: Configure the Server

### Option A: Use Default Configuration
The server automatically discovers datasets in the `./datasets/` directory (relative to where you run the command).

### Option B: Custom Dataset Directory
Create a `.env` file or set environment variable:
```bash
export KNOWLEDGE_DATASETS_DIR=/path/to/your/datasets
```

Or use CLI flag:
```bash
mcpower --datasets /path/to/your/datasets --stdio
```

### Option C: Configuration File (future)
Not yet implemented in v0.1.0. Use environment variables or CLI flags.

---

## Step 4: Start the Server

### For MCP Client Integration (stdio mode - default)
```bash
mcpower --stdio
```

The server listens on stdin/stdout for MCP protocol messages. This is the mode used by VS Code Copilot, Cherry Studio, and other MCP clients.

**Verify Startup**:
Check stderr for startup logs (stdout is reserved for MCP protocol):
```
{"level":"info","time":"2025-11-02T10:30:00.000Z","msg":"mcpower server starting","version":"0.1.0"}
{"level":"info","time":"2025-11-02T10:30:01.234Z","msg":"Dataset loaded","dataset":"cherry-docs"}
{"level":"info","time":"2025-11-02T10:30:01.456Z","msg":"Server ready","datasetsLoaded":1}
```

### For Testing (HTTP mode - future)
```bash
mcpower --http --port 3000
```
Not yet implemented in v0.1.0. Use stdio mode with MCP client test harness.

---

## Step 5: Connect an MCP Client

### VS Code Copilot Configuration

Add to your VS Code `settings.json`:
```json
{
  "mcp.servers": {
    "mcpower": {
      "command": "mcpower",
      "args": ["--stdio"],
      "env": {
        "KNOWLEDGE_DATASETS_DIR": "/path/to/your/datasets"
      }
    }
  }
}
```

Restart VS Code. Copilot will now have access to `knowledge.search` and `knowledge.listDatasets` tools.

### Cherry Studio Configuration

1. Open Cherry Studio Settings
2. Navigate to MCP Servers
3. Add new server:
   - **Name**: mcpower
   - **Command**: `mcpower --stdio`
   - **Working Directory**: (leave empty or set to project root)
4. Save and restart Cherry Studio

---

## Step 6: Perform a Search

### Via MCP Client (VS Code Copilot)

In VS Code, ask Copilot a question that requires your documentation:
```
@mcpower How do I install Cherry Studio?
```

Copilot will use the `knowledge.search` tool behind the scenes.

### Via Direct MCP Protocol (for testing)

Send JSON-RPC over stdin:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "knowledge.search",
    "arguments": {
      "dataset": "cherry-docs",
      "query": "How do I install?",
      "topK": 3
    }
  }
}
```

Expected response on stdout:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "results": [
      {
        "score": 0.893,
        "title": "Installation Guide",
        "path": "docs/getting-started/installation.md",
        "snippet": "To install Cherry Studio, first ensure..."
      }
    ]
  }
}
```

---

## Step 7: List Available Datasets

### Via MCP Tool Call
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "knowledge.listDatasets",
    "arguments": {}
  }
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "datasets": [
      {
        "id": "cherry-docs",
        "name": "Cherry Studio Documentation",
        "description": "Embeddings built from the Cherry Studio docs repository",
        "defaultTopK": 5,
        "status": "ready"
      }
    ],
    "metadata": {
      "totalDatasets": 1,
      "readyDatasets": 1,
      "errorDatasets": 0
    }
  }
}
```

---

## Troubleshooting

### Error: "Dataset 'X' not found"
**Cause**: Dataset ID doesn't match any registered manifest  
**Solution**: 
1. Check `datasets/` directory contains `X/manifest.json`
2. Verify manifest `id` field matches requested dataset
3. Check server startup logs for dataset loading errors

### Error: "Python bridge failed"
**Cause**: Python bridge subprocess couldn't execute  
**Solution**:
1. Verify Python 3.10+ is on your PATH: `python --version`
2. Install required packages: `pip install faiss-cpu sentence-transformers typer`
3. Check `python/bridge.py` exists in project directory
4. Increase log level: `mcpower --stdio --log-level debug`

### Error: "Index directory not found"
**Cause**: FAISS index path in manifest is invalid  
**Solution**:
1. Verify `index` path in manifest.json points to existing directory
2. Check directory contains `.faiss` or `.index` files
3. Use absolute paths if relative paths fail

### Slow Search Performance (>500ms)
**Cause**: FAISS index not optimized or dataset too large  
**Solution**:
1. Ensure FAISS index uses appropriate quantization (IVF, PQ)
2. Reduce `topK` parameter (fewer results = faster search)
3. Check Python bridge logs for initialization time
4. Consider pre-warming cache on startup (all datasets loaded once)

### No Datasets Loaded
**Cause**: Manifest validation failed or directory not found  
**Solution**:
1. Check server logs (stderr) for specific validation errors
2. Verify JSON syntax in manifest.json files
3. Ensure `KNOWLEDGE_DATASETS_DIR` points to correct directory
4. Test manifest schema: `cat manifest.json | jq .` (should parse successfully)

---

## Next Steps

### Add More Datasets
Repeat Step 2 for each new knowledge source:
```bash
datasets/
├── cherry-docs/
│   └── manifest.json
├── openwebui-docs/
│   └── manifest.json
└── tts-docs/
    └── manifest.json
```

Restart server to discover new datasets.

### Integrate with Your Workflow
- **VS Code Extension**: Create workspace-specific dataset configurations
- **CI/CD**: Automate embedding generation and dataset deployment
- **Monitoring**: Collect structured logs for search analytics

### Generate Embeddings (Future Guide)
See `docs/embedding-generation.md` for instructions on building FAISS indexes from your documentation (not yet created in v0.1.0).

---

## Configuration Reference

### CLI Flags
| Flag | Default | Description |
|------|---------|-------------|
| `--stdio` | true | Enable stdio transport (MCP protocol over stdin/stdout) |
| `--datasets <path>` | `./datasets` | Path to datasets directory |
| `--log-level <level>` | `info` | Log level (debug, info, warn, error) |

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `KNOWLEDGE_DATASETS_DIR` | `./datasets` | Datasets directory path |
| `LOG_LEVEL` | `info` | Log level |

### Manifest Schema
See `contracts/dataset-manifest.json` for full JSON schema definition.

---

## Support

- **Issues**: https://github.com/yourusername/mcpower/issues
- **Discussions**: https://github.com/yourusername/mcpower/discussions
- **Documentation**: https://github.com/yourusername/mcpower/tree/main/docs

---

## What's Next?

You've successfully set up the mcpower MCP server! The server is now ready to provide knowledge search capabilities to your MCP clients.

**Recommended Next Steps**:
1. Create additional datasets for your other documentation sources
2. Configure VS Code Copilot to use specific datasets for different projects
3. Explore advanced search patterns (combining multiple queries, filtering results)
4. Monitor search performance and adjust `topK` values for optimal speed

**Coming in Future Versions**:
- Hot-reload of datasets without server restart
- Dataset health monitoring dashboard
- Built-in embedding generation tools
- Query history and analytics
