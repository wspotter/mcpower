# MCP Power Examples

This directory contains examples and configuration files for using MCP Power with various MCP clients.

## Files

- **queries.md**: Example search queries for the sample dataset
- **vscode-settings.json**: VS Code MCP configuration
- **cherry-studio-config.json**: Cherry Studio MCP server configuration
- **test-client.js**: Simple Node.js test client

## VS Code Setup

1. Copy `vscode-settings.json` content to your VS Code settings
2. Update the absolute paths to point to your mcpower installation
3. Reload VS Code
4. The MCP Power tools should be available in Copilot

### VS Code Configuration

Add to `.vscode/settings.json` in your workspace:

```json
{
  "mcpServers": {
    "mcpower": {
      "command": "node",
      "args": [
        "/path/to/mcpower/dist/cli.js",
        "--datasets",
        "/path/to/mcpower/datasets"
      ]
    }
  }
}
```

## Cherry Studio Setup

1. Open Cherry Studio settings
2. Navigate to MCP Servers section
3. Add a new server using the configuration from `cherry-studio-config.json`
4. Update the paths to match your installation
5. Restart Cherry Studio

## Testing the Server

### Using the Test Client

```bash
# Install dependencies
npm install

# Run the test client
node examples/test-client.js
```

### Manual Testing

```bash
# Start the server
npm run dev -- --datasets ./datasets --log-level debug

# In another terminal, send a request
echo '{"tool": "knowledge.search", "arguments": {"dataset": "sample-docs", "query": "getting started", "topK": 3}}' | \
  node dist/cli.js --datasets ./datasets
```

## Example Queries

See [queries.md](queries.md) for a comprehensive list of example queries you can try.

### Quick Test

```javascript
// In an MCP client
const result = await callTool({
  name: 'knowledge.search',
  arguments: {
    dataset: 'sample-docs',
    query: 'How do I configure datasets?',
    topK: 5
  }
});
```

## Troubleshooting

### Server Not Starting

- Check that paths in configuration are absolute
- Verify Node.js 18+ is installed
- Ensure dependencies are installed: `npm install`
- Check build is up to date: `npm run build`

### No Results Returned

- Verify dataset exists: `ls datasets/`
- Check dataset manifest is valid
- Try `knowledge.listDatasets` to see available datasets
- Increase `topK` parameter

### Python Errors

- Ensure Python 3.10+ is installed
- Install Python dependencies: `cd python && pip install -r requirements.txt`
- Test FAISS: `python -c "import faiss; print('OK')"`

## Next Steps

1. Create your own dataset (see [README.md](../README.md#dataset-management))
2. Build FAISS embeddings from your documents
3. Test with different queries
4. Integrate with your favorite MCP client

For more information, see the [Quick Start Guide](../specs/001-mcp-server-core/quickstart.md).
