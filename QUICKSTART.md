# MCPower - Quick Start Guide

## What You Just Built

You've successfully created a **vector search knowledge base** from the Cherry Studio documentation! 

## Dataset Statistics

### cherry-studio-docs
- 📄 **914 source documents** from `/home/stacy/cherry-studio-docs`
- 🧩 **1,264 searchable chunks** (with 64-word overlap for better context)
- 🤖 **sentence-transformers/all-MiniLM-L6-v2** embedding model
- 📊 **384-dimensional vectors** indexed with FAISS

### sample-docs
- 📄 **5 sample documents** for testing
- 🎯 Demonstrates basic functionality

## How to Use

### 1. Web Console (Dataset Management)

Start the web console:
```bash
npm run web
```

Then open http://127.0.0.1:4173 in your browser to:
- View all datasets
- Create new datasets from document directories
- Delete datasets
- See dataset statistics

### 2. MCP Server (Search & Integration)

The MCP server provides search functionality through the Model Context Protocol:

```bash
npm start
```

This starts the MCP server that client applications can connect to for:
- Semantic search across your knowledge bases
- Integration with AI assistants
- Context-aware document retrieval

### 3. Create More Datasets

Use the Python indexer directly:

```bash
.venv/bin/python python/indexer.py \
  --source /path/to/your/docs \
  --dataset-id my-docs \
  --name "My Documentation" \
  --description "Description here" \
  --output ./datasets
```

Or use the web console's create dataset endpoint:

```bash
curl -X POST http://127.0.0.1:4173/api/datasets \
  -H "Content-Type: application/json" \
  -d '{
    "sourcePath": "/path/to/docs",
    "datasetId": "my-docs",
    "name": "My Documentation",
    "description": "Description here"
  }'
```

## Environment Variables

Create a `.env` file with:

```bash
MCPOWER_PYTHON=/home/stacy/mcpower/.venv/bin/python
MCPOWER_DATASETS=./datasets
MCPOWER_WEB_PORT=4173
MCPOWER_WEB_HOST=127.0.0.1
LOG_LEVEL=info
```

## Dataset Directory Structure

Each dataset in `./datasets/` contains:

```
datasets/
└── cherry-studio-docs/
    ├── manifest.json          # Dataset configuration
    ├── metadata.json          # Document metadata (6MB for 1264 chunks)
    └── index/
        └── docs.index         # FAISS vector index (1.9MB)
```

## Supported Document Formats

- `.txt` - Plain text files
- `.md` - Markdown files

## Testing

Run all tests:
```bash
npm test
```

Run web server tests:
```bash
./test-web.sh
```

## What's Next?

1. **Connect an MCP Client**: Use Claude Desktop or another MCP-compatible client to search your knowledge base
2. **Add More Datasets**: Index other documentation sets you want to search
3. **Customize Chunking**: Adjust `--chunk-size` and `--chunk-overlap` for your documents
4. **Try Different Models**: Use `--model` flag to try other sentence-transformer models

## Troubleshooting

### Server won't start
```bash
# Kill any running instances
pkill -f "tsx src/web/server.ts"

# Restart
npm run web
```

### Python dependencies missing
```bash
.venv/bin/pip install typer faiss-cpu sentence-transformers
```

### Index validation fails
Check that your Python path is correct in `.env`:
```bash
echo $MCPOWER_PYTHON
```

## Architecture

- **TypeScript/Node.js**: MCP server and web console
- **Python**: FAISS indexing and vector search
- **Express**: Web API for dataset management
- **FAISS**: Fast approximate nearest neighbor search
- **Sentence Transformers**: Text embedding generation

---

**Congratulations! Your knowledge base is ready to use! 🎉**
