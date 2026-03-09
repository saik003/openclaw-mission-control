"""Many-to-many relationship between agents and boards.

Allows a single agent to participate in multiple boards with different roles.
Replaces the legacy Agent.board_id / Agent.is_board_lead columns
(scheduled for removal 2 weeks post-deploy).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import UniqueConstraint
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class AgentBoard(QueryModel, table=True):
    """Association between an agent and a board, with role metadata."""

    __tablename__ = "agent_boards"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint("agent_id", "board_id", name="uq_agent_board"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    agent_id: UUID = Field(foreign_key="agents.id", index=True)
    board_id: UUID = Field(foreign_key="boards.id", index=True)
    role: str = Field(default="worker", index=True)  # "lead" | "worker"
    is_primary: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)
