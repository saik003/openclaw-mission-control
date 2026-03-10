"""Agent job queue worker.

Polls agent_jobs for queued work, enforces max_concurrency=1 per agent,
dispatches runs via gateway, and updates job status.

Run as: python -m app.services.agent_job_worker
"""

from __future__ import annotations

import asyncio
import signal
from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import col, func, select

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.db.session import async_session_maker
from app.models.agent_jobs import AgentJob
from app.models.agents import Agent
from app.models.gateways import Gateway
from app.services.openclaw.gateway_dispatch import GatewayDispatchService
from app.services.openclaw.gateway_resolver import optional_gateway_client_config

logger = get_logger(__name__)

POLL_INTERVAL_SECONDS = 5
MAX_CONCURRENCY_PER_AGENT = 1
STALE_RUNNING_TIMEOUT_MINUTES = 60


async def _count_running(session, agent_id: UUID) -> int:
    result = await session.exec(
        select(func.count(AgentJob.id)).where(
            (col(AgentJob.agent_id) == agent_id)
            & (col(AgentJob.status) == "running")
        )
    )
    return result.one()


async def _pick_next_job(session) -> AgentJob | None:
    """Find the highest-priority queued job whose agent has capacity."""
    queued_jobs = (
        await session.exec(
            select(AgentJob)
            .where(col(AgentJob.status) == "queued")
            .order_by(col(AgentJob.priority).desc(), col(AgentJob.created_at))
        )
    ).all()

    for job in queued_jobs:
        running = await _count_running(session, job.agent_id)
        if running < MAX_CONCURRENCY_PER_AGENT:
            # Check lock conflict
            if job.lock_key:
                conflict = (
                    await session.exec(
                        select(AgentJob).where(
                            (col(AgentJob.lock_key) == job.lock_key)
                            & (col(AgentJob.status) == "running")
                            & (col(AgentJob.id) != job.id)
                        )
                    )
                ).first()
                if conflict is not None:
                    continue
            return job
    return None


async def _dispatch_job(session, job: AgentJob) -> bool:
    """Send the job instructions to the agent's session. Returns True on success."""
    agent = await session.get(Agent, job.agent_id)
    if agent is None or not agent.openclaw_session_id:
        logger.warning(
            "worker.dispatch.no_session",
            extra={"job_id": str(job.id), "agent_id": str(job.agent_id)},
        )
        return False

    dispatch = GatewayDispatchService(session)
    gateway = await session.get(Gateway, agent.gateway_id) if agent.gateway_id else None
    if gateway is None:
        logger.warning(
            "worker.dispatch.no_gateway",
            extra={"job_id": str(job.id), "agent_id": str(job.agent_id)},
        )
        return False

    config = optional_gateway_client_config(gateway)
    if config is None:
        return False

    message = (
        f"[AGENT JOB {job.id}]\n"
        f"Board: {job.board_id}\n"
        f"Task: {job.task_id or 'N/A'}\n"
        f"Trigger: {job.trigger_type}\n"
        f"Title: {job.title}\n\n"
        f"{job.instructions or ''}\n\n"
        "When finished, update the job status accordingly."
    )

    err = await dispatch.try_send_agent_message(
        session_key=agent.openclaw_session_id,
        config=config,
        agent_name=agent.name,
        message=message,
        deliver=False,
    )
    if err is not None:
        logger.error(
            "worker.dispatch.failed",
            extra={
                "job_id": str(job.id),
                "agent_id": str(job.agent_id),
                "error": str(err),
            },
        )
        return False

    logger.info(
        "worker.dispatch.sent",
        extra={
            "job_id": str(job.id),
            "agent_id": str(job.agent_id),
            "agent_name": agent.name,
            "session_key": agent.openclaw_session_id,
        },
    )
    return True


async def _mark_stale_jobs(session) -> int:
    """Mark long-running jobs as failed to prevent blocking."""
    cutoff = datetime.now(timezone.utc).replace(
        tzinfo=None
    ) - __import__("datetime").timedelta(minutes=STALE_RUNNING_TIMEOUT_MINUTES)
    stale = (
        await session.exec(
            select(AgentJob).where(
                (col(AgentJob.status) == "running")
                & (col(AgentJob.started_at) < cutoff)
            )
        )
    ).all()
    for job in stale:
        job.status = "failed"
        job.error_message = f"Timed out after {STALE_RUNNING_TIMEOUT_MINUTES}m"
        job.finished_at = utcnow()
        session.add(job)
    if stale:
        await session.commit()
        logger.warning("worker.stale_jobs_marked", extra={"count": len(stale)})
    return len(stale)


async def _process_one_cycle() -> int:
    """Run one cycle: pick a job, dispatch it, mark it running. Returns jobs dispatched."""
    dispatched = 0
    async with async_session_maker() as session:
        await _mark_stale_jobs(session)

        job = await _pick_next_job(session)
        if job is None:
            return 0

        # Mark as running
        job.status = "running"
        job.started_at = utcnow()
        job.attempt_count += 1
        session.add(job)
        await session.commit()
        await session.refresh(job)

        success = await _dispatch_job(session, job)
        if not success:
            if job.attempt_count >= job.max_attempts:
                job.status = "failed"
                job.error_message = "Dispatch failed after max attempts"
                job.finished_at = utcnow()
            else:
                job.status = "queued"
                job.started_at = None
            session.add(job)
            await session.commit()
        else:
            dispatched = 1

    return dispatched


_shutdown = False


def _handle_signal(*_):
    global _shutdown
    _shutdown = True


async def run_worker_loop() -> None:
    """Main worker loop — polls for queued jobs and dispatches them."""
    logger.info("agent_job_worker.started", extra={"poll_interval": POLL_INTERVAL_SECONDS})
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    while not _shutdown:
        try:
            dispatched = await _process_one_cycle()
            if dispatched:
                logger.info("agent_job_worker.dispatched", extra={"count": dispatched})
        except Exception:
            logger.exception("agent_job_worker.cycle_error")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)

    logger.info("agent_job_worker.stopped")


def main() -> None:
    asyncio.run(run_worker_loop())


if __name__ == "__main__":
    main()
