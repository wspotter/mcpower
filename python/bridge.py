#!/usr/bin/env python3
"""
Python Bridge for MCP Knowledge Server
Handles FAISS vector search operations
"""
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List
import typer

app = typer.Typer(help="Python bridge for MCP knowledge search operations")

DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _require_faiss():
    try:
        import faiss  # type: ignore
    except ImportError as exc:  # pragma: no cover - runtime dependency check
        raise RuntimeError('faiss-cpu is not installed') from exc
    return faiss


def _load_documents(metadata_path: Path) -> Dict[str, Any]:
    content = metadata_path.read_text(encoding='utf-8')
    data = json.loads(content)
    if isinstance(data, list):
        return {
            'model': DEFAULT_MODEL,
            'documents': data
        }
    if not isinstance(data, dict):
        raise ValueError('Metadata file must contain an object or array of documents')
    if 'documents' not in data or not isinstance(data['documents'], list):
        raise ValueError('Metadata file missing "documents" array')
    return data


def _resolve_index_file(index_path: Path) -> Path:
    if index_path.is_file():
        return index_path

    candidates = sorted(list(index_path.glob('*.index')) + list(index_path.glob('*.faiss')))
    if not candidates:
        raise FileNotFoundError(f"No FAISS index files found in {index_path}")
    return candidates[0]


@app.command()
def search(
    index: str = typer.Option(..., help="Path to FAISS index directory"),
    metadata: str = typer.Option(..., help="Path to metadata JSON file"),
    query: str = typer.Option(..., help="Search query text"),
    k: int = typer.Option(5, help="Number of results to return")
):
    """
    Search a knowledge dataset using FAISS similarity search
    Returns JSON with results array to stdout
    """
    start_time = time.time()
    
    try:
        faiss = _require_faiss()
        from sentence_transformers import SentenceTransformer

        index_path = Path(index)
        metadata_path = Path(metadata)

        if not index_path.exists():
            raise FileNotFoundError(f"Index directory not found: {index}")
        if not metadata_path.exists():
            raise FileNotFoundError(f"Metadata file not found: {metadata}")

        documents_payload = _load_documents(metadata_path)
        documents = documents_payload['documents']
        model_name = documents_payload.get('model', DEFAULT_MODEL)

        index_file = _resolve_index_file(index_path)
        faiss_index = faiss.read_index(str(index_file))

        if faiss_index.ntotal == 0:
            raise RuntimeError('FAISS index contains no vectors')

        model = SentenceTransformer(model_name)
        query_embedding = model.encode([query], convert_to_numpy=True)
        query_vec = query_embedding.astype('float32')
        faiss.normalize_L2(query_vec)

        top_k = min(max(k, 1), faiss_index.ntotal)
        scores, indices = faiss_index.search(query_vec, top_k)

        results: List[Dict[str, Any]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(documents):
                continue
            doc = documents[idx]
            title = doc.get('title') or doc.get('path') or f'Document {idx}'
            snippet = doc.get('snippet') or doc.get('content', '')[:200]
            results.append({
                "id": doc.get('id', str(idx)),
                "score": float(score),
                "title": title,
                "path": doc.get('path', ''),
                "snippet": snippet
            })

        payload = {
            "results": results,
            "duration_ms": int((time.time() - start_time) * 1000),
            "dataset_size": int(faiss_index.ntotal)
        }

        print(json.dumps(payload))
        sys.exit(0)

    except Exception as e:
        error_result = {
            "error": str(e),
            "error_type": type(e).__name__
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


@app.command()
def validate_index(
    index: str = typer.Option(..., help="Path to FAISS index directory")
):
    """
    Validate that a FAISS index exists and is readable
    Returns JSON with status to stdout
    Phase 5: Enhanced validation with FAISS property inspection
    """
    try:
        index_path = Path(index)
        
        # Check if directory exists
        if not index_path.exists():
            result = {
                "status": "error",
                "error": f"Index directory does not exist: {index}"
            }
            print(json.dumps(result))
            sys.exit(1)
        
        # Check if it's a directory
        if not index_path.is_dir():
            result = {
                "status": "error",
                "error": f"Index path is not a directory: {index}"
            }
            print(json.dumps(result))
            sys.exit(1)
        
        # List index files
        index_files = list(index_path.glob("*.index")) + list(index_path.glob("*.faiss"))
        
        if len(index_files) == 0:
            result = {
                "status": "error",
                "error": f"No FAISS index files found in {index}",
                "details": "Expected files with .index or .faiss extension"
            }
            print(json.dumps(result))
            sys.exit(1)
        
        # Try to load and inspect the index if FAISS is available
        try:
            import faiss
            
            # Attempt to read the first index file
            index_file = index_files[0]
            try:
                faiss_index = faiss.read_index(str(index_file))
                
                # Collect index properties
                result = {
                    "status": "ok",
                    "index_path": str(index_path),
                    "index_file": str(index_file),
                    "properties": {
                        "is_trained": bool(faiss_index.is_trained),
                        "ntotal": int(faiss_index.ntotal),
                        "d": int(faiss_index.d)  # dimension
                    }
                }
                
                # Additional validation checks
                if not faiss_index.is_trained:
                    result["warning"] = "Index is not trained"
                
                if faiss_index.ntotal == 0:
                    result["warning"] = "Index contains no vectors"
                
                print(json.dumps(result))
                sys.exit(0)
                
            except Exception as read_error:
                result = {
                    "status": "error",
                    "error": f"Failed to read FAISS index file: {str(read_error)}",
                    "index_file": str(index_file)
                }
                print(json.dumps(result))
                sys.exit(1)
        
        except ImportError:
            # FAISS not installed - do basic file checks only
            result = {
                "status": "ok",
                "index_path": str(index_path),
                "index_files": [str(f) for f in index_files],
                "warning": "FAISS not installed - could not inspect index properties"
            }
            print(json.dumps(result))
            sys.exit(0)
        
    except Exception as e:
        error_result = {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


@app.command()
def health_check():
    """
    Check if the Python bridge is functioning correctly
    Returns JSON with health status to stdout
    """
    try:
        result = {
            "status": "healthy",
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "dependencies": {
                "typer": "installed",
                "numpy": "installed"
            }
        }
        
        # Try importing optional dependencies
        try:
            import faiss
            result["dependencies"]["faiss"] = "installed"
        except ImportError:
            result["dependencies"]["faiss"] = "not_installed"
        
        try:
            import sentence_transformers
            result["dependencies"]["sentence_transformers"] = "installed"
        except ImportError:
            result["dependencies"]["sentence_transformers"] = "not_installed"
        
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        error_result = {
            "status": "unhealthy",
            "error": str(e),
            "error_type": type(e).__name__
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    app()
