# Sample Knowledge Base Dataset

This is a sample dataset demonstrating the MCP Power server capabilities.

## Contents

- **manifest.json**: Dataset metadata and configuration
- **metadata.json**: Document metadata (5 sample documents)
- **index/docs.index**: FAISS vector index with 384-dimensional embeddings

## Sample Documents

1. **Getting Started with MCP Power** - Introduction and installation
2. **Configuring Datasets** - How to set up datasets
3. **Using the Search Tool** - Search tool documentation
4. **Listing Available Datasets** - List datasets tool documentation
5. **Troubleshooting Common Issues** - Common problems and solutions

## Example Queries

Try searching this dataset with queries like:
- "How do I get started?"
- "How to configure a dataset"
- "What tools are available?"
- "Troubleshooting search issues"

## Technical Details

- **Dimension**: 384 (compatible with sentence-transformers models like all-MiniLM-L6-v2)
- **Index Type**: IndexFlatIP (cosine similarity via inner product on normalized vectors)
- **Documents**: 5
- **Default topK**: 5
