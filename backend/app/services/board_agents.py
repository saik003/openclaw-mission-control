"""Service for batch board–agent membership operations.

Manages the AgentBoard M2M join table directly, without triggering gateway
reprovisioning.  This is appropriate for board-membership changes that don't
affect the agent's runtime configuration (adding/removing a board assignment
is a metadata operation).
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlmodel import col, select

from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.agent_boards import AgentBoard
from app.models.agents import Agent

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

logger = get_logger(__name__)


async def add_agents_to_board(
    session: AsyncSession,
    *,
    board_id: UUID,
    agent_ids: list[UUID],
) -> tuple[list[UUID], list[UUID]]:
    """Add agents to a board via the agent_boards M2M table.

    Returns (added, skipped) — skipped agents are already on the board.
    Dual-writes Agent.board_id for agents that had no board assignment.
    """
    if not agent_ids:
        return [], []

    # Load existing links for these agents on this board
    existing = set(
        row.agent_id
        for row in await session.exec(
            select(AgentBoard).where(
                col(AgentBoard.board_id) == board_id,
                col(AgentBoard.agent_id).in_(agent_ids),
            )
        )
    )

    # Load the agents to check existence and dual-write legacy board_id
    agents_by_id: dict[UUID, Agent] = {}
    if agent_ids:
        rows = await session.exec(
            select(Agent).where(col(Agent.id).in_(agent_ids))
        )
        agents_by_id = {a.id: a for a in rows}

    added: list[UUID] = []
    skipped: list[UUID] = []

    for agent_id in agent_ids:
        if agent_id in existing:
            skipped.append(agent_id)
            continue

        agent = agents_by_id.get(agent_id)
        if agent is None:
            skipped.append(agent_id)
            continue

        # Determine if this should be the primary board
        has_other_links = (
            await session.exec(
                select(AgentBoard.id)
                .where(AgentBoard.agent_id == agent_id)
                .limit(1)
            )
        ).first()
        is_primary = has_other_links is None

        link = AgentBoard(
            agent_id=agent_id,
            board_id=board_id,
            role="lead" if agent.is_board_lead else "worker",
            is_primary=is_primary,
        )
        session.add(link)

        # Dual-write: set legacy board_id if agent doesn't have one
        if agent.board_id is None:
            agent.board_id = board_id
            agent.updated_at = utcnow()
            session.add(agent)

        added.append(agent_id)

    if added:
        await session.commit()
        logger.info(
            "board_agents.add board_id=%s added=%d skipped=%d",
            board_id,
            len(added),
            len(skipped),
        )

    return added, skipped


async def remove_agents_from_board(
    session: AsyncSession,
    *,
    board_id: UUID,
    agent_ids: list[UUID],
) -> tuple[list[UUID], list[UUID]]:
    """Remove agents from a board via the agent_boards M2M table.

    Returns (removed, skipped) — skipped agents were not on the board.
    Dual-writes Agent.board_id when the removed board was the primary.
    """
    if not agent_ids:
        return [], []

    # Load existing links for these agents on this board
    links = list(
        await session.exec(
            select(AgentBoard).where(
                col(AgentBoard.board_id) == board_id,
                col(AgentBoard.agent_id).in_(agent_ids),
            )
        )
    )
    linked_agent_ids = {link.agent_id for link in links}

    removed: list[UUID] = []
    skipped: list[UUID] = []

    for agent_id in agent_ids:
        if agent_id not in linked_agent_ids:
            skipped.append(agent_id)
            continue

    # Delete the links
    for link in links:
        await session.delete(link)
        removed.append(link.agent_id)

    if removed:
        await session.flush()

        # Dual-write: update legacy board_id for affected agents
        agents = list(
            await session.exec(
                select(Agent).where(col(Agent.id).in_(removed))
            )
        )
        for agent in agents:
            if agent.board_id == board_id:
                # Find another board for this agent, or set to None
                remaining = (
                    await session.exec(
                        select(AgentBoard)
                        .where(AgentBoard.agent_id == agent.id)
                        .order_by(AgentBoard.is_primary.desc())
                        .limit(1)
                    )
                ).first()
                agent.board_id = remaining.board_id if remaining else None
                agent.updated_at = utcnow()
                session.add(agent)

        await session.commit()
        logger.info(
            "board_agents.remove board_id=%s removed=%d skipped=%d",
            board_id,
            len(removed),
            len(skipped),
        )

    return removed, skipped
