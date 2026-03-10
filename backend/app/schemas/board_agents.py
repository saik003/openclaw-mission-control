"""Schemas for batch board–agent membership operations."""

from __future__ import annotations

from uuid import UUID

from sqlmodel import SQLModel, Field


class BoardAgentsBatchPayload(SQLModel):
    """Payload for batch add/remove of agents on a board."""

    agent_ids: list[UUID] = Field(
        description="Agent UUIDs to add or remove.",
        min_length=1,
    )


class BoardAgentsBatchResult(SQLModel):
    """Result summary for a batch board–agent operation."""

    added: list[UUID] = Field(default_factory=list, description="Agent IDs successfully added.")
    removed: list[UUID] = Field(default_factory=list, description="Agent IDs successfully removed.")
    skipped: list[UUID] = Field(
        default_factory=list,
        description="Agent IDs skipped (already present for add, or not on board for remove).",
    )
