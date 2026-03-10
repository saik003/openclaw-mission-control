"""Agent job queue and workload endpoints."""

from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlmodel import col, select

from app.api.deps import require_org_admin
from app.db.session import get_session
from app.models.agent_jobs import AgentJob
from app.models.agents import Agent
from app.models.gateways import Gateway
from app.schemas.agent_jobs import AgentJobRead, AgentWorkloadRead
from app.services.organizations import OrganizationContext

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

router = APIRouter(prefix="/agent-jobs", tags=["agent-jobs"])
SESSION_DEP = Depends(get_session)
ORG_ADMIN_DEP = Depends(require_org_admin)
STATUS_QUERY = Query(default=None)


@router.get("/workload", response_model=list[AgentWorkloadRead])
async def get_agent_workload(
    status: str | None = STATUS_QUERY,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_ADMIN_DEP,
) -> list[AgentWorkloadRead]:
    """Return kanban-style workload grouped by agent."""
    agents = (
        await session.exec(
            select(Agent)
            .join(Gateway, col(Gateway.id) == col(Agent.gateway_id))
            .where(col(Gateway.organization_id) == ctx.organization.id)
            .order_by(col(Agent.name))
        )
    ).all()
    visible_agents = [
        agent for agent in agents if "gateway agent" not in (agent.name or "").lower()
    ]
    if not visible_agents:
        return []

    agent_ids = [agent.id for agent in visible_agents]
    jobs_query = select(AgentJob).where(col(AgentJob.agent_id).in_(agent_ids))
    if status:
        jobs_query = jobs_query.where(col(AgentJob.status) == status)
    jobs_query = jobs_query.order_by(
        col(AgentJob.priority).desc(),
        col(AgentJob.created_at),
    )
    jobs = (await session.exec(jobs_query)).all()

    jobs_by_agent: dict[UUID, list[AgentJob]] = defaultdict(list)
    for job in jobs:
        jobs_by_agent[job.agent_id].append(job)

    result: list[AgentWorkloadRead] = []
    for agent in visible_agents:
        agent_jobs = jobs_by_agent.get(agent.id, [])
        running = [AgentJobRead.model_validate(job) for job in agent_jobs if job.status == "running"]
        queued = [AgentJobRead.model_validate(job) for job in agent_jobs if job.status == "queued"]
        failed = [AgentJobRead.model_validate(job) for job in agent_jobs if job.status == "failed"]
        result.append(
            AgentWorkloadRead(
                agent_id=agent.id,
                agent_name=agent.name,
                agent_model=agent.model,
                running=running,
                queued=queued,
                failed=failed,
            )
        )
    return result
