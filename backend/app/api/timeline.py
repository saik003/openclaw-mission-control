"""Timeline API — aggregates memory files from all agent workspaces."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.logging import get_logger

router = APIRouter(prefix="/timeline", tags=["timeline"])
logger = get_logger(__name__)

OPENCLAW_CONFIG = Path.home() / ".openclaw" / "openclaw.json"
MAIN_WORKSPACE = Path.home() / ".openclaw" / "workspace"


class TimelineEntry(BaseModel):
    agent_id: str  # gateway agent id (mc-...)
    agent_name: str
    filename: str
    date: str  # YYYY-MM-DD or raw filename
    size: int
    modified: str  # ISO 8601
    path: str


class TimelineEntryContent(TimelineEntry):
    content: str


def _get_agent_workspaces() -> list[tuple[str, str, Path]]:
    """Return (agent_id, agent_name, workspace_path) for all agents."""
    result: list[tuple[str, str, Path]] = []
    # Main agent (Origen)
    if MAIN_WORKSPACE.is_dir():
        result.append(("main", "Origen", MAIN_WORKSPACE))
    try:
        config = json.loads(OPENCLAW_CONFIG.read_text(encoding="utf-8"))
        agents_list = config.get("agents", {}).get("list", [])
        for agent in agents_list:
            agent_id = agent.get("id", "")
            if not agent_id or agent_id == "main":
                continue
            name = agent.get("name", agent_id)
            ws = agent.get("workspace")
            if ws:
                ws_path = Path(ws).expanduser().resolve()
                if ws_path.is_dir():
                    result.append((agent_id, name, ws_path))
    except Exception as exc:
        logger.warning("Could not read openclaw.json for timeline: %s", exc)
    return result


def _scan_memory_dir(
    agent_id: str, agent_name: str, workspace: Path
) -> list[TimelineEntry]:
    memory_dir = workspace / "memory"
    if not memory_dir.is_dir():
        return []
    entries: list[TimelineEntry] = []
    for entry in memory_dir.iterdir():
        if not entry.is_file() or entry.suffix != ".md":
            continue
        stat = entry.stat()
        modified = datetime.fromtimestamp(
            stat.st_mtime, tz=timezone.utc
        ).isoformat()
        # Extract date from filename
        name = entry.stem
        date_match = name[:10] if len(name) >= 10 and name[:4].isdigit() else name
        entries.append(
            TimelineEntry(
                agent_id=agent_id,
                agent_name=agent_name,
                filename=entry.name,
                date=date_match,
                size=stat.st_size,
                modified=modified,
                path=str(entry),
            )
        )
    return entries


@router.get("", response_model=list[TimelineEntry])
async def list_timeline(
    date: str | None = Query(default=None, description="Filter by date (YYYY-MM-DD)"),
    agent_id: str | None = Query(default=None, description="Filter by agent id"),
) -> list[TimelineEntry]:
    """List all memory entries from all agents, newest first."""
    all_entries: list[TimelineEntry] = []
    for aid, name, ws in _get_agent_workspaces():
        if agent_id and aid != agent_id:
            continue
        all_entries.extend(_scan_memory_dir(aid, name, ws))
    if date:
        all_entries = [e for e in all_entries if e.date == date]
    # Sort by date descending, then agent name
    all_entries.sort(key=lambda e: (e.date, e.agent_name), reverse=True)
    return all_entries


@router.get("/{agent_id}/{filename}", response_model=TimelineEntryContent)
async def read_timeline_entry(agent_id: str, filename: str) -> TimelineEntryContent:
    """Read a specific memory file content."""
    from fastapi import HTTPException, status

    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    for aid, name, ws in _get_agent_workspaces():
        if aid == agent_id:
            filepath = ws / "memory" / filename
            if filepath.is_file():
                content = filepath.read_text(encoding="utf-8")
                stat = filepath.stat()
                modified = datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat()
                date_match = filename[:10] if len(filename) >= 10 and filename[:4].isdigit() else filename.replace(".md", "")
                return TimelineEntryContent(
                    agent_id=aid,
                    agent_name=name,
                    filename=filename,
                    date=date_match,
                    size=stat.st_size,
                    modified=modified,
                    path=str(filepath),
                    content=content,
                )
    raise HTTPException(status_code=404, detail="Memory file not found.")
