import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import BACKEND_DIR


SUPPORTED_EXTENSIONS = {".json", ".jsonl", ".md", ".txt"}
DEFAULT_ALLOWED_ROLES = "all,collaborateur,manager,rh,direction"
DEFAULT_DOCUMENT_TYPE = "policy"
DEFAULT_CONFIDENTIALITY = "internal"
DEFAULT_VERSION = "1.0"
DEFAULT_DEPARTMENT = "all"
DEFAULT_CHUNK_SIZE = 700
DEFAULT_CHUNK_OVERLAP = 120


@dataclass(frozen=True)
class IngestionDocument:
    document_id: str
    text: str
    metadata: dict[str, Any]


def get_rh_documents_path() -> Path:
    path = BACKEND_DIR / "data" / "rh_docs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "document"


def _build_chunk_id(source_name: str, chunk_index: int, content: str) -> str:
    digest = hashlib.sha1(content.encode("utf-8")).hexdigest()[:10]
    return f"{_slugify(source_name)}_{chunk_index:03d}_{digest}"


def _normalize_metadata(raw_metadata: dict[str, Any], source_name: str, chunk_index: int) -> dict[str, Any]:
    metadata = dict(raw_metadata)
    metadata.setdefault("title", source_name)
    metadata.setdefault("type", DEFAULT_DOCUMENT_TYPE)
    metadata.setdefault("allowed_roles", DEFAULT_ALLOWED_ROLES)
    metadata.setdefault("department", DEFAULT_DEPARTMENT)
    metadata.setdefault("confidentiality", DEFAULT_CONFIDENTIALITY)
    metadata.setdefault("version", DEFAULT_VERSION)
    metadata["source_name"] = source_name
    metadata["chunk_index"] = chunk_index
    return metadata


def _split_text(text: str, chunk_size: int = DEFAULT_CHUNK_SIZE, overlap: int = DEFAULT_CHUNK_OVERLAP) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []
    if len(normalized) <= chunk_size:
        return [normalized]

    chunks: list[str] = []
    start = 0
    text_length = len(normalized)
    while start < text_length:
        end = min(start + chunk_size, text_length)
        if end < text_length:
            boundary = normalized.rfind(" ", start, end)
            if boundary > start:
                end = boundary
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_length:
            break
        start = max(end - overlap, 0)
    return chunks


def _documents_from_record(record: dict[str, Any], source_name: str) -> list[IngestionDocument]:
    text = str(record.get("text", "")).strip()
    if not text:
        return []

    metadata = {
        key: value
        for key, value in record.items()
        if key not in {"id", "document_id", "text"}
    }
    base_identifier = str(record.get("id") or record.get("document_id") or source_name)
    chunks = _split_text(text)
    documents: list[IngestionDocument] = []
    for chunk_index, chunk in enumerate(chunks, start=1):
        document_id = _build_chunk_id(base_identifier, chunk_index, chunk)
        documents.append(
            IngestionDocument(
                document_id=document_id,
                text=chunk,
                metadata=_normalize_metadata(metadata, source_name, chunk_index),
            )
        )
    return documents


def _load_json_file(path: Path) -> list[IngestionDocument]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload if isinstance(payload, list) else [payload]
    documents: list[IngestionDocument] = []
    for record in records:
        if isinstance(record, dict):
            documents.extend(_documents_from_record(record, path.stem))
    return documents


def _load_jsonl_file(path: Path) -> list[IngestionDocument]:
    documents: list[IngestionDocument] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        record = json.loads(line)
        if isinstance(record, dict):
            documents.extend(_documents_from_record(record, path.stem))
    return documents


def _load_text_file(path: Path) -> list[IngestionDocument]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []

    record = {
        "id": path.stem,
        "text": text,
        "title": path.stem.replace("_", " ").replace("-", " ").title(),
        "type": "guide" if path.suffix == ".md" else DEFAULT_DOCUMENT_TYPE,
    }
    return _documents_from_record(record, path.stem)


def load_ingestion_documents(path: Path) -> list[IngestionDocument]:
    extension = path.suffix.lower()
    if extension == ".json":
        return _load_json_file(path)
    if extension == ".jsonl":
        return _load_jsonl_file(path)
    if extension in {".md", ".txt"}:
        return _load_text_file(path)
    return []


def collect_documents(root: Path | None = None) -> list[IngestionDocument]:
    documents_root = root or get_rh_documents_path()
    documents: list[IngestionDocument] = []
    for path in sorted(documents_root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        documents.extend(load_ingestion_documents(path))
    return documents
