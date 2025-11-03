# Feature Spec: Dataset Creation & Indexing Tools

**Feature ID**: 002-dataset-creation  
**Status**: Draft  
**Created**: 2025-11-02  
**Owner**: Development Team

---

## 1. Overview

### Problem Statement
Currently, users must manually:
- Create FAISS indexes using Python scripts
- Generate embeddings with sentence-transformers
- Create manifest.json and metadata.json files
- Organize files in the correct directory structure

This creates a significant barrier to entry and makes the MCP server difficult to use.

### Solution Summary
Provide CLI tooling to automatically index documents and create ready-to-use datasets:
- `mcpower index` command to create datasets from files/folders
- Python utilities for embedding generation
- Automatic manifest and metadata generation
- Support for multiple document formats (txt, md, pdf, docx)

### Success Criteria
- Users can create a dataset with a single command
- Indexing process completes in <5 minutes for 1000 documents
- Clear progress feedback during indexing
- Generated datasets work seamlessly with existing search functionality
- Comprehensive documentation and examples

---

## 2. User Stories

### US-001: Index Local Documents
**As a** developer  
**I want to** index a folder of markdown files  
**So that** I can search them using the MCP server

**Acceptance Criteria:**
- Can run `mcpower index ./docs --dataset my-docs --name "My Docs"`
- Process recursively finds all supported files
- Generates embeddings for each document
- Creates manifest.json and metadata.json
- Shows progress bar during indexing
- Outputs dataset ready for use

### US-002: Choose Embedding Model
**As a** power user  
**I want to** specify which embedding model to use  
**So that** I can optimize for quality vs speed

**Acceptance Criteria:**
- Can specify model via `--model` flag
- Supports common models: all-MiniLM-L6-v2, all-mpnet-base-v2, etc.
- Shows model info and estimated time
- Defaults to balanced model (all-MiniLM-L6-v2)

### US-003: Update Existing Dataset
**As a** user  
**I want to** add documents to an existing dataset  
**So that** I can incrementally update my knowledge base

**Acceptance Criteria:**
- Can run `mcpower index ./new-docs --dataset existing-docs --append`
- Preserves existing documents
- Updates metadata with new documents
- Rebuilds FAISS index with all documents

### US-004: Document Chunking
**As a** user indexing large documents  
**I want** automatic chunking of long documents  
**So that** search results are more precise

**Acceptance Criteria:**
- Automatically chunks documents over 512 tokens
- Preserves context with overlapping chunks
- Tracks original document in metadata
- Configurable chunk size via `--chunk-size`

---

## 3. Technical Design

### 3.1 Architecture

```
┌─────────────────────────────────────────┐
│         mcpower index CLI               │
│  (src/commands/index.ts)                │
└────────────┬────────────────────────────┘
             │
             ├─→ Document Discovery
             │   - Recursive file finder
             │   - File type detection
             │   - Content extraction
             │
             ├─→ Python Indexing Bridge
             │   (python/indexer.py)
             │   - Embedding generation
             │   - FAISS index creation
             │   - Batch processing
             │
             └─→ Metadata Generation
                 - manifest.json
                 - metadata.json
                 - Dataset stats
```

### 3.2 CLI Interface

```bash
# Basic usage
mcpower index <source-path> --dataset <dataset-id>

# Full options
mcpower index <source-path> \
  --dataset <dataset-id> \
  --name <display-name> \
  --description <description> \
  --model <embedding-model> \
  --chunk-size <tokens> \
  --chunk-overlap <tokens> \
  --file-types <extensions> \
  --output <datasets-dir> \
  --append \
  --verbose

# Examples
mcpower index ./docs --dataset my-docs --name "My Documentation"
mcpower index ./notes --dataset notes --model all-mpnet-base-v2
mcpower index ./new-docs --dataset existing --append
```

### 3.3 Python Indexer

**File**: `python/indexer.py`

Key components:
- `DocumentLoader` - Extracts text from various formats
- `Chunker` - Splits documents into semantic chunks
- `EmbeddingGenerator` - Uses sentence-transformers
- `IndexBuilder` - Creates FAISS index
- `MetadataWriter` - Generates JSON files

```python
class DatasetIndexer:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        
    def index_documents(
        self, 
        source_path: Path,
        dataset_id: str,
        output_dir: Path,
        chunk_size: int = 512,
        chunk_overlap: int = 50
    ) -> DatasetStats:
        """
        Index documents and create dataset.
        
        Returns:
            DatasetStats with document count, embedding dimensions, etc.
        """
        pass
```

### 3.4 File Format Support

**Priority 1 (MVP)**:
- `.txt` - Plain text
- `.md` - Markdown

**Priority 2**:
- `.pdf` - PDF documents (via PyPDF2)
- `.docx` - Word documents (via python-docx)
- `.html` - HTML pages (via BeautifulSoup)

**Priority 3**:
- `.rst` - ReStructuredText
- `.ipynb` - Jupyter notebooks
- `.json` - JSON documents

### 3.5 Data Structures

**Manifest Schema** (unchanged):
```typescript
interface DatasetManifest {
  id: string;
  name: string;
  description: string;
  index: string;
  metadata: string;
  defaultTopK: number;
  createdAt?: string;
  updatedAt?: string;
  documentCount?: number;
  embeddingDimensions?: number;
  model?: string;
}
```

**Enhanced Metadata Schema**:
```typescript
interface EnhancedMetadata {
  documents: Array<{
    id: string;
    title: string;
    path: string;
    text: string;
    chunk?: number;           // NEW: chunk index if document was split
    chunkTotal?: number;      // NEW: total chunks from this document
    originalDoc?: string;     // NEW: original doc ID if chunked
    fileType?: string;        // NEW: original file type
    size?: number;            // NEW: file size in bytes
    createdAt?: string;       // NEW: indexing timestamp
  }>;
  stats?: {                   // NEW: dataset statistics
    totalDocuments: number;
    totalChunks: number;
    embeddingDimensions: number;
    model: string;
    indexedAt: string;
  };
}
```

---

## 4. Implementation Plan

### Phase 1: Basic Indexing (Priority: High)
**Goal**: Index text and markdown files

**Tasks**:
- T048: Create `src/commands/index.ts` CLI command
- T049: Implement `python/indexer.py` core functionality
- T050: Add document discovery (txt, md files)
- T051: Generate embeddings using sentence-transformers
- T052: Create FAISS index
- T053: Write manifest.json and metadata.json
- T054: Add progress feedback and logging
- T055: Unit tests for indexer components
- T056: Integration test: index sample docs
- T057: Documentation: indexing guide

**Estimated effort**: 2-3 days

### Phase 2: Document Chunking (Priority: Medium)
**Goal**: Handle large documents effectively

**Tasks**:
- T058: Implement chunking strategy
- T059: Add chunk overlap configuration
- T060: Track chunk relationships in metadata
- T061: Test with large documents (>10k tokens)
- T062: Update search results to show chunk context

**Estimated effort**: 1-2 days

### Phase 3: Extended Format Support (Priority: Medium)
**Goal**: Support PDF and DOCX files

**Tasks**:
- T063: Add PDF text extraction (PyPDF2)
- T064: Add DOCX text extraction (python-docx)
- T065: Add HTML text extraction (BeautifulSoup)
- T066: Test with real-world documents
- T067: Document supported formats

**Estimated effort**: 1-2 days

### Phase 4: Dataset Management (Priority: Low)
**Goal**: Update and manage existing datasets

**Tasks**:
- T068: Implement `--append` mode
- T069: Add `mcpower dataset list` command
- T070: Add `mcpower dataset info <id>` command
- T071: Add `mcpower dataset delete <id>` command
- T072: Add `mcpower dataset validate <id>` command

**Estimated effort**: 1 day

---

## 5. Testing Strategy

### 5.1 Unit Tests
- Document loader for each file type
- Chunking algorithm with various sizes
- Embedding generation
- FAISS index creation
- Metadata generation

### 5.2 Integration Tests
- End-to-end indexing of sample dataset
- Verify indexed dataset works with search
- Test append mode
- Test large dataset (1000+ documents)

### 5.3 Performance Tests
- Index 1000 documents in <5 minutes
- Memory usage stays under 2GB
- Generated index loads in <1 second

### 5.4 Manual Testing
- Index real documentation (e.g., Next.js docs)
- Search indexed dataset from MCP client
- Verify results are relevant

---

## 6. Documentation Requirements

### 6.1 User Guide
- How to index your documents
- Choosing the right embedding model
- Chunking strategies for large documents
- Troubleshooting indexing issues

### 6.2 CLI Reference
- `mcpower index` command documentation
- All flags and options explained
- Common usage examples

### 6.3 Developer Guide
- How the indexing pipeline works
- Adding support for new file formats
- Customizing embedding models

---

## 7. Dependencies

### New Python Dependencies
```
sentence-transformers>=2.2.0
faiss-cpu>=1.7.4
typer>=0.9.0
rich>=13.0.0
PyPDF2>=3.0.0           # Phase 3
python-docx>=1.0.0      # Phase 3
beautifulsoup4>=4.12.0  # Phase 3
```

### New TypeScript Dependencies
```
cli-progress  # Progress bars
chalk         # Terminal colors
```

---

## 8. Security Considerations

### Input Validation
- Validate file paths to prevent directory traversal
- Limit maximum file size (default 50MB)
- Sanitize dataset IDs (alphanumeric + hyphens only)
- Validate file types by content, not just extension

### Resource Limits
- Maximum documents per batch (default 100)
- Memory limit for embedding generation
- Timeout for long-running operations
- Disk space checks before indexing

### Privacy
- No external API calls (all local processing)
- No telemetry or tracking
- User documents never leave machine

---

## 9. Open Questions

1. **Model storage**: Should we bundle a default model or require users to download?
   - **Recommendation**: Download on first use with clear prompt

2. **Incremental indexing**: Should we support updating individual documents?
   - **Recommendation**: Phase 4 feature, start with full rebuild

3. **Multi-language support**: Should we auto-detect language and use language-specific models?
   - **Recommendation**: Start with English, add language detection in future

4. **Cloud sources**: Should we support indexing from URLs or cloud storage?
   - **Recommendation**: Start with local files, add cloud support later

---

## 10. Future Enhancements

- Web crawler to index entire websites
- Git integration to index repository history
- Automatic re-indexing on file changes (watch mode)
- Dataset merging and splitting
- Embedding model fine-tuning utilities
- Multi-modal support (images, code)
- Distributed indexing for massive datasets

---

## 11. Success Metrics

- **Usability**: Users can create first dataset in <5 minutes
- **Performance**: Index 1000 docs in <5 minutes
- **Quality**: Search precision >0.8 on sample queries
- **Adoption**: >50% of users create their own datasets (vs using sample)
- **Support**: <10% of questions are about indexing issues

---

## 12. References

- [FAISS Documentation](https://github.com/facebookresearch/faiss/wiki)
- [Sentence Transformers](https://www.sbert.net/)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- Original PLAN.md Section 2 (Dataset Registry Contract)
