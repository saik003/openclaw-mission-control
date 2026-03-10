"""API for reading/writing agent workspace files directly from the filesystem.

Reads the gateway config (openclaw.json) to resolve each MC agent's workspace
directory, then serves .md files from there.  No database involved.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.logging import get_logger

router = APIRouter(prefix="/agents/{agent_id}/files", tags=["agent-files"])
logger = get_logger(__name__)

OPENCLAW_CONFIG = Path.home() / ".openclaw" / "openclaw.json"
DEFAULT_WORKSPACE = Path.home() / ".openclaw" / "workspace"

# Files we expose for viewing/editing
ALLOWED_FILES = [
    "SOUL.md",
    "IDENTITY.md",
    "AGENTS.md",
    "TOOLS.md",
    "MEMORY.md",
    "HEARTBEAT.md",
    "USER.md",
]


def _resolve_workspace(agent_id: UUID) -> Path:
    """Look up the workspace path for an MC agent from openclaw.json."""
    mc_agent_key = f"mc-{agent_id}"
    try:
        config = json.loads(OPENCLAW_CONFIG.read_text(encoding="utf-8"))
        agents_list = config.get("agents", {}).get("list", [])
        for agent in agents_list:
            if agent.get("id") == mc_agent_key:
                ws = agent.get("workspace")
                if ws:
                    resolved = Path(ws).expanduser().resolve()
                    if resolved.is_dir():
                        return resolved
                break
    except Exception as exc:
        logger.warning("Could not read openclaw.json: %s", exc)
    # Fallback: try the conventional path
    fallback = Path.home() / f".openclaw/workspace-{mc_agent_key}"
    if fallback.is_dir():
        return fallback
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Workspace not found for agent {agent_id}.",
    )


# ── Models ─────────────────────────────────────────────────────────────


class AgentFileRead(BaseModel):
    filename: str
    content: str
    exists: bool


class AgentFileWrite(BaseModel):
    content: str


class AgentFileListItem(BaseModel):
    filename: str
    exists: bool
    size: int


class MemoryFileListItem(BaseModel):
    filename: str
    size: int
    modified: str  # ISO 8601


class MemoryFileRead(BaseModel):
    filename: str
    content: str


# ── Workspace files ────────────────────────────────────────────────────


@router.get("", response_model=list[AgentFileListItem])
async def list_agent_files(agent_id: UUID) -> list[AgentFileListItem]:
    """List all known workspace files for an agent."""
    agent_dir = _resolve_workspace(agent_id)
    result: list[AgentFileListItem] = []
    for filename in ALLOWED_FILES:
        filepath = agent_dir / filename
        if filepath.is_file():
            result.append(
                AgentFileListItem(
                    filename=filename,
                    exists=True,
                    size=filepath.stat().st_size,
                )
            )
        else:
            result.append(
                AgentFileListItem(filename=filename, exists=False, size=0)
            )
    # Also include any .md files that exist but aren't in the standard list
    if agent_dir.is_dir():
        for entry in sorted(agent_dir.iterdir()):
            if (
                entry.is_file()
                and entry.suffix == ".md"
                and entry.name not in ALLOWED_FILES
            ):
                result.append(
                    AgentFileListItem(
                        filename=entry.name,
                        exists=True,
                        size=entry.stat().st_size,
                    )
                )
    return result


# ── Memory diary (read-only) — MUST be before /{filename} ─────────────


@router.get("/memory", response_model=list[MemoryFileListItem])
async def list_memory_files(agent_id: UUID) -> list[MemoryFileListItem]:
    """List all files in the agent's memory/ directory, newest first."""
    workspace = _resolve_workspace(agent_id)
    memory_dir = workspace / "memory"
    if not memory_dir.is_dir():
        return []
    result: list[MemoryFileListItem] = []
    for entry in sorted(memory_dir.iterdir(), reverse=True):
        if entry.is_file() and entry.suffix == ".md":
            stat = entry.stat()
            modified = datetime.fromtimestamp(
                stat.st_mtime, tz=timezone.utc
            ).isoformat()
            result.append(
                MemoryFileListItem(
                    filename=entry.name,
                    size=stat.st_size,
                    modified=modified,
                )
            )
    return result


@router.get("/memory/{filename}", response_model=MemoryFileRead)
async def read_memory_file(agent_id: UUID, filename: str) -> MemoryFileRead:
    """Read a single memory file (read-only)."""
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )
    workspace = _resolve_workspace(agent_id)
    filepath = workspace / "memory" / filename
    if not filepath.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory file '{filename}' not found.",
        )
    try:
        content = filepath.read_text(encoding="utf-8")
    except Exception as exc:
        logger.error("Failed to read memory file %s: %s", filepath, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to read file: {exc}",
        ) from exc
    return MemoryFileRead(filename=filename, content=content)


# ── Shared docs (read-only, from main workspace) ──────────────────────


MAIN_WORKSPACE = Path.home() / ".openclaw" / "workspace"


@router.get("/docs", response_model=list[MemoryFileListItem])
async def list_docs_files(agent_id: UUID) -> list[MemoryFileListItem]:
    """List all files in the shared docs/ directory (main workspace)."""
    _ = _resolve_workspace(agent_id)  # validate agent exists
    docs_dir = MAIN_WORKSPACE / "docs"
    if not docs_dir.is_dir():
        return []
    result: list[MemoryFileListItem] = []
    for entry in sorted(docs_dir.iterdir()):
        if entry.is_file() and entry.suffix == ".md":
            stat = entry.stat()
            modified = datetime.fromtimestamp(
                stat.st_mtime, tz=timezone.utc
            ).isoformat()
            result.append(
                MemoryFileListItem(
                    filename=entry.name,
                    size=stat.st_size,
                    modified=modified,
                )
            )
    return result


@router.get("/docs/{filename}", response_model=MemoryFileRead)
async def read_docs_file(agent_id: UUID, filename: str) -> MemoryFileRead:
    """Read a shared doc file (read-only)."""
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )
    _ = _resolve_workspace(agent_id)  # validate agent exists
    filepath = MAIN_WORKSPACE / "docs" / filename
    if not filepath.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Doc '{filename}' not found.",
        )
    try:
        content = filepath.read_text(encoding="utf-8")
    except Exception as exc:
        logger.error("Failed to read doc %s: %s", filepath, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to read file: {exc}",
        ) from exc
    return MemoryFileRead(filename=filename, content=content)


# ── Individual file read/write ─────────────────────────────────────────


@router.get("/{filename}", response_model=AgentFileRead)
async def read_agent_file(agent_id: UUID, filename: str) -> AgentFileRead:
    """Read a single agent workspace file."""
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )
    agent_dir = _resolve_workspace(agent_id)
    filepath = agent_dir / filename
    if not filepath.is_file():
        return AgentFileRead(filename=filename, content="", exists=False)
    try:
        content = filepath.read_text(encoding="utf-8")
    except Exception as exc:
        logger.error("Failed to read %s: %s", filepath, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to read file: {exc}",
        ) from exc
    return AgentFileRead(filename=filename, content=content, exists=True)


@router.put("/{filename}", response_model=AgentFileRead)
async def write_agent_file(
    agent_id: UUID, filename: str, payload: AgentFileWrite
) -> AgentFileRead:
    """Write (create or overwrite) an agent workspace file."""
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )
    if not filename.endswith(".md"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .md files can be written.",
        )
    agent_dir = _resolve_workspace(agent_id)
    agent_dir.mkdir(parents=True, exist_ok=True)
    filepath = agent_dir / filename
    try:
        filepath.write_text(payload.content, encoding="utf-8")
    except Exception as exc:
        logger.error("Failed to write %s: %s", filepath, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to write file: {exc}",
        ) from exc
    logger.info(
        "agent_files.write agent_id=%s file=%s bytes=%d",
        agent_id,
        filename,
        len(payload.content),
    )
    return AgentFileRead(
        filename=filename, content=payload.content, exists=True
    )
