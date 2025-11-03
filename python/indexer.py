#!/usr/bin/env python3
"""Dataset indexing utilities for MCPower."""

from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Tuple

import numpy as np
import typer

app = typer.Typer(help="Create FAISS datasets from local documents")

SUPPORTED_EXTENSIONS = {".txt", ".md"}
DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


class DatasetIndexerError(Exception):
    """Raised when the dataset indexer encounters an error."""


def validate_dataset_id(dataset_id: str) -> None:
    if not dataset_id or not dataset_id.isascii():
        raise DatasetIndexerError("Dataset ID must be ASCII lowercase alphanumeric with hyphens")

    if any(ch for ch in dataset_id if ch not in "abcdefghijklmnopqrstuvwxyz0123456789-"):
        raise DatasetIndexerError("Dataset ID must be lowercase alphanumeric with hyphens only")


def discover_files(source: Path) -> Iterable[Path]:
    if source.is_file():
        if source.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield source
        return

    for path in sorted(source.rglob('*')):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield path


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        return path.read_text(encoding='utf-8', errors='ignore')


def extract_title(path: Path, text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if path.suffix.lower() == '.md' and stripped.startswith('#'):
            return stripped.lstrip('#').strip()
        return stripped[:120]
    return path.stem.replace('-', ' ').title()


def chunk_text(text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
    words = text.split()
    if not words:
        return []

    if chunk_size <= 0:
        raise DatasetIndexerError('Chunk size must be greater than zero')

    if chunk_overlap >= chunk_size:
        chunk_overlap = chunk_size // 4

    step = max(chunk_size - chunk_overlap, 1)
    chunks: List[str] = []
    for start in range(0, len(words), step):
        chunk_words = words[start:start + chunk_size]
        if not chunk_words:
            continue
        chunk = ' '.join(chunk_words)
        chunks.append(chunk)
        if start + chunk_size >= len(words):
            break
    return chunks


def safe_relative(path: Path, base: Path) -> str:
    try:
        return str(path.relative_to(base))
    except ValueError:
        return path.name


def _require_faiss():
    try:
        import faiss  # type: ignore
    except ImportError as exc:  # pragma: no cover - runtime dependency check
        raise DatasetIndexerError('faiss-cpu is not installed') from exc
    return faiss


def build_index(
    texts: List[str],
    model_name: str,
    batch_size: int = 32
) -> Tuple[np.ndarray, int]:
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:  # pragma: no cover - runtime dependency check
        raise DatasetIndexerError('sentence-transformers is not installed') from exc

    model = SentenceTransformer(model_name)
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        convert_to_numpy=True,
        show_progress_bar=False
    )

    faiss = _require_faiss()
    embeddings = embeddings.astype('float32')
    faiss.normalize_L2(embeddings)
    dimension = embeddings.shape[1]
    return embeddings, dimension


def write_index(path: Path, embeddings: np.ndarray) -> None:
    faiss = _require_faiss()
    dimension = embeddings.shape[1]
    faiss_index = faiss.IndexFlatIP(dimension)
    faiss_index.add(embeddings)
    path.parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(faiss_index, str(path))


@app.command()
def index(
    source: Path = typer.Option(..., '--source', exists=True, file_okay=True, dir_okay=True, readable=True, help='Source file or directory'),
    dataset_id: str = typer.Option(..., '--dataset-id', help='Dataset identifier (lowercase, hyphenated)'),
    output: Path = typer.Option(Path('./datasets'), '--output', help='Output datasets directory'),
    name: str = typer.Option(..., '--name', help='Dataset display name'),
    description: str = typer.Option('', '--description', help='Dataset description'),
    model: str = typer.Option(DEFAULT_MODEL, '--model', help='Embedding model name'),
    chunk_size: int = typer.Option(512, '--chunk-size', min=64, max=4096, help='Number of words per chunk'),
    chunk_overlap: int = typer.Option(64, '--chunk-overlap', min=0, max=1024, help='Number of overlapping words between chunks')
) -> None:
    start_time = time.time()

    try:
        validate_dataset_id(dataset_id)

        files = list(discover_files(source))
        if not files:
            raise DatasetIndexerError('No supported files found to index')

        dataset_dir = output.joinpath(dataset_id)
        if dataset_dir.exists():
            raise DatasetIndexerError(f"Dataset '{dataset_id}' already exists")

        dataset_dir.mkdir(parents=True, exist_ok=False)
        index_dir = dataset_dir.joinpath('index')
        metadata_path = dataset_dir.joinpath('metadata.json')
        manifest_path = dataset_dir.joinpath('manifest.json')

        documents: List[dict] = []
        embedding_texts: List[str] = []
        indexed_files = 0
        total_chunks = 0

        for file_path in files:
            text = read_text(file_path)
            if not text.strip():
                continue

            chunks = chunk_text(text, chunk_size, chunk_overlap)
            if not chunks:
                continue

            indexed_files += 1
            title = extract_title(file_path, text)
            rel_path = safe_relative(file_path, source)

            for idx, chunk in enumerate(chunks):
                doc_id = f"{dataset_id}-{total_chunks + 1}"
                snippet = chunk[:200].strip()
                documents.append({
                    'id': doc_id,
                    'title': title,
                    'path': rel_path,
                    'content': chunk,
                    'snippet': snippet if len(snippet) < len(chunk) else snippet,
                    'chunk': idx + 1,
                    'chunk_total': len(chunks)
                })
                embedding_texts.append(chunk)
                total_chunks += 1

        if not embedding_texts:
            raise DatasetIndexerError('No text content available to index')

        embeddings, dimension = build_index(embedding_texts, model)
        write_index(index_dir.joinpath('docs.index'), embeddings)

        now_iso = datetime.utcnow().isoformat() + 'Z'
        metadata = {
            'datasetId': dataset_id,
            'name': name,
            'description': description,
            'model': model,
            'createdAt': now_iso,
            'stats': {
                'totalFiles': indexed_files,
                'totalChunks': len(documents),
                'embeddingDimensions': dimension,
                'indexedAt': now_iso
            },
            'documents': documents
        }
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding='utf-8')

        manifest = {
            'id': dataset_id,
            'name': name,
            'description': description or f'Dataset created from {source}',
            'index': 'index',
            'metadata': 'metadata.json',
            'defaultTopK': 5
        }
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')

        result = {
            'datasetId': dataset_id,
            'documents': metadata['stats']['totalFiles'],
            'chunks': metadata['stats']['totalChunks'],
            'model': model,
            'embeddingDimensions': dimension,
            'indexPath': str(index_dir.resolve()),
            'metadataPath': str(metadata_path.resolve()),
            'durationMs': int((time.time() - start_time) * 1000)
        }

        print(json.dumps(result))
    except DatasetIndexerError as error:
        typer.echo(json.dumps({'error': str(error)}), err=True)
        raise typer.Exit(code=1)
    except Exception as error:  # pragma: no cover - safeguard
        typer.echo(json.dumps({'error': str(error)}), err=True)
        raise typer.Exit(code=1)


if __name__ == '__main__':
    app()
