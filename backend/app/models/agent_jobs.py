"""Queued/running jobs assigned to agents."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, Text
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class AgentJob(QueryModel, table=True):
    """Internal execution unit queued for an agent."""

    __tablename__ = "agent_jobs"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    agent_id: UUID = Field(foreign_key="agents.id", index=True)
    board_id: UUID = Field(foreign_key="boards.id", index=True)
    task_id: UUID | None = Field(default=None, foreign_key="tasks.id", index=True)
    webhook_id: UUID | None = Field(default=None, foreign_key="board_webhooks.id", index=True)
    payload_id: UUID | None = Field(
        default=None, foreign_key="board_webhook_payloads.id", index=True
    )
    trigger_type: str = Field(default="manual", index=True)
    title: str = Field(index=True)
    instructions: str | None = Field(default=None, sa_column=Column(Text))
    status: str = Field(default="queued", index=True)
    priority: int = Field(default=0, index=True)
    lock_key: str | None = Field(default=None, index=True)
    run_session_key: str | None = Field(default=None, index=True)
    attempt_count: int = Field(default=0)
    max_attempts: int = Field(default=3)
    error_message: str | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=utcnow, index=True)
    started_at: datetime | None = Field(default=None, index=True)
    finished_at: datetime | None = Field(default=None, index=True)
