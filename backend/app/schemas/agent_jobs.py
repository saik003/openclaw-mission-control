"""Schemas for agent job queue/workload views."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class AgentJobRead(SQLModel):
    id: UUID
    agent_id: UUID
    board_id: UUID
    task_id: UUID | None = None
    webhook_id: UUID | None = None
    payload_id: UUID | None = None
    trigger_type: str
    title: str
    instructions: str | None = None
    status: str
    priority: int
    lock_key: str | None = None
    run_session_key: str | None = None
    attempt_count: int
    max_attempts: int
    error_message: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class AgentWorkloadRead(SQLModel):
    agent_id: UUID
    agent_name: str
    agent_model: str | None = None
    running: list[AgentJobRead]
    queued: list[AgentJobRead]
    failed: list[AgentJobRead] = []
