"""Shared docs API — aggregates .md files from multiple workspace sources."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.logging import get_logger

router = APIRouter(prefix="/docs", tags=["docs"])
logger = get_logger(__name__)

MAIN_WORKSPACE = Path.home() / ".openclaw" / "workspace"

# Sources to scan for docs (label, path)
DOC_SOURCES: list[tuple[str, Path]] = [
    ("docs", MAIN_WORKSPACE / "docs"),
    ("plans", MAIN_WORKSPACE / "plans"),
    ("project", MAIN_WORKSPACE / "openclaw-mission-control" / "docs"),
]


class DocFileListItem(BaseModel):
    filename: str
    source: str  # which folder it came from
    path: str  # full filesystem path
    size: int
    modified: str


class DocFileRead(BaseModel):
    filename: str
    source: str
    path: str
    content: str


def _scan_dir(label: str, directory: Path) -> list[DocFileListItem]:
    if not directory.is_dir():
        return []
    result: list[DocFileListItem] = []
    for entry in sorted(directory.iterdir()):
        if entry.is_file() and entry.suffix == ".md":
            stat = entry.stat()
            modified = datetime.fromtimestamp(
                stat.st_mtime, tz=timezone.utc
            ).isoformat()
            result.append(
                DocFileListItem(
                    filename=entry.name,
                    source=label,
                    path=str(entry),
                    size=stat.st_size,
                    modified=modified,
                )
            )
    return result


def _resolve_file(source: str, filename: str) -> Path | None:
    for label, directory in DOC_SOURCES:
        if label == source:
            filepath = directory / filename
            if filepath.is_file():
                return filepath
    return None


@router.get("", response_model=list[DocFileListItem])
async def list_docs() -> list[DocFileListItem]:
    """List all .md doc files from all sources."""
    result: list[DocFileListItem] = []
    for label, directory in DOC_SOURCES:
        result.extend(_scan_dir(label, directory))
    # Also scan agent workspaces for docs/ subdirs
    agents_base = Path.home() / ".openclaw"
    for ws_dir in sorted(agents_base.glob("workspace-mc-*")):
        agent_docs = ws_dir / "docs"
        if agent_docs.is_dir():
            agent_label = ws_dir.name.replace("workspace-", "")
            result.extend(_scan_dir(agent_label, agent_docs))
    return result


@router.get("/{source}/{filename}", response_model=DocFileRead)
async def read_doc(source: str, filename: str) -> DocFileRead:
    """Read a single doc file from a specific source."""
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )
    # Check standard sources
    filepath = _resolve_file(source, filename)
    # Check agent workspace sources
    if filepath is None and source.startswith("mc-"):
        agent_docs = Path.home() / ".openclaw" / f"workspace-{source}" / "docs"
        candidate = agent_docs / filename
        if candidate.is_file():
            filepath = candidate
    if filepath is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{filename}' not found in '{source}'.",
        )
    try:
        content = filepath.read_text(encoding="utf-8")
    except Exception as exc:
        logger.error("Failed to read doc %s: %s", filepath, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to read file: {exc}",
        ) from exc
    return DocFileRead(filename=filename, source=source, path=str(filepath), content=content)
