# Example Queries for Sample Dataset

This document provides example queries you can use to test the `sample-docs` dataset.

## Basic Queries

### Getting Started
```json
{
  "tool": "knowledge.search",
  "arguments": {
    "dataset": "sample-docs",
    "query": "How do I get started with MCP Power?",
    "topK": 3
  }
}
```

**Expected**: Returns documents about getting started and installation.

### Configuration
```json
{
  "tool": "knowledge.search",
  "arguments": {
    "dataset": "sample-docs",
    "query": "How to configure a dataset",
    "topK": 5
  }
}
```

**Expected**: Returns documents about dataset configuration and manifest files.

### Tool Usage
```json
{
  "tool": "knowledge.search",
  "arguments": {
    "dataset": "sample-docs",
    "query": "What tools are available?",
    "topK": 3
  }
}
```

**Expected**: Returns documents about the search and listDatasets tools.

### Troubleshooting
```json
{
  "tool": "knowledge.search",
  "arguments": {
    "dataset": "sample-docs",
    "query": "Search is not working",
    "topK": 3
  }
}
```

**Expected**: Returns troubleshooting documentation.

## Advanced Queries

### Semantic Understanding
```json
{
  "tool": "knowledge.search",
  "arguments": {
    "dataset": "sample-docs",
    "query": "I'm having issues with performance",
    "topK": 3
  }
}
```

**Expected**: Should find troubleshooting content about performance issues.

### Different Phrasings
```json
{
  "tool": "knowledge.search",
  "arguments": {
    "dataset": "sample-docs",
    "query": "setup instructions",
    "topK": 2
  }
}
```

**Expected**: Should match "Getting Started" content despite different wording.

## List Datasets Example

```json
{
  "tool": "knowledge.listDatasets",
  "arguments": {}
}
```

**Expected Response**:
```json
{
  "datasets": [
    {
      "id": "sample-docs",
      "name": "Sample Knowledge Base",
      "description": "A sample knowledge base demonstrating the MCP Power server capabilities...",
      "defaultTopK": 5
    }
  ],
  "metadata": {
    "total": 1,
    "ready": 1,
    "errors": 0
  }
}
```

## Testing from Command Line

You can test these queries using the MCP inspector or by writing a simple client script.

### Using Node.js

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/cli.js', '--datasets', './datasets']
});

const client = new Client({
  name: 'test-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// Search example
const result = await client.callTool({
  name: 'knowledge.search',
  arguments: {
    dataset: 'sample-docs',
    query: 'How do I get started?',
    topK: 3
  }
});

console.log(JSON.stringify(result, null, 2));
```

## Tips for Writing Effective Queries

1. **Be Natural**: Write queries as you would ask a person
   - Good: "How do I configure a dataset?"
   - Also good: "dataset configuration"

2. **Use Keywords**: Include important terms
   - "troubleshooting search errors"
   - "FAISS index validation"

3. **Adjust topK**: 
   - Use 3-5 for focused results
   - Use 10+ for comprehensive coverage

4. **Experiment**: Try different phrasings to see semantic matching in action
