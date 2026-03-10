"""Create agent_jobs table.

Revision ID: k1a2b3c4d5f0
Revises: j1a2b3c4d5e9
Create Date: 2026-03-10 16:10:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "k1a2b3c4d5f0"
down_revision = "j1a2b3c4d5e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("board_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("webhook_id", sa.Uuid(), nullable=True),
        sa.Column("payload_id", sa.Uuid(), nullable=True),
        sa.Column("trigger_type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lock_key", sa.String(), nullable=True),
        sa.Column("run_session_key", sa.String(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["board_id"], ["boards.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.ForeignKeyConstraint(["webhook_id"], ["board_webhooks.id"]),
        sa.ForeignKeyConstraint(["payload_id"], ["board_webhook_payloads.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, cols in [
        ("ix_agent_jobs_agent_id", ["agent_id"]),
        ("ix_agent_jobs_board_id", ["board_id"]),
        ("ix_agent_jobs_task_id", ["task_id"]),
        ("ix_agent_jobs_webhook_id", ["webhook_id"]),
        ("ix_agent_jobs_payload_id", ["payload_id"]),
        ("ix_agent_jobs_trigger_type", ["trigger_type"]),
        ("ix_agent_jobs_title", ["title"]),
        ("ix_agent_jobs_status", ["status"]),
        ("ix_agent_jobs_priority", ["priority"]),
        ("ix_agent_jobs_lock_key", ["lock_key"]),
        ("ix_agent_jobs_run_session_key", ["run_session_key"]),
        ("ix_agent_jobs_created_at", ["created_at"]),
        ("ix_agent_jobs_started_at", ["started_at"]),
        ("ix_agent_jobs_finished_at", ["finished_at"]),
    ]:
        op.create_index(name, "agent_jobs", cols)


def downgrade() -> None:
    for name in [
        "ix_agent_jobs_finished_at",
        "ix_agent_jobs_started_at",
        "ix_agent_jobs_created_at",
        "ix_agent_jobs_run_session_key",
        "ix_agent_jobs_lock_key",
        "ix_agent_jobs_priority",
        "ix_agent_jobs_status",
        "ix_agent_jobs_title",
        "ix_agent_jobs_trigger_type",
        "ix_agent_jobs_payload_id",
        "ix_agent_jobs_webhook_id",
        "ix_agent_jobs_task_id",
        "ix_agent_jobs_board_id",
        "ix_agent_jobs_agent_id",
    ]:
        op.drop_index(name, table_name="agent_jobs")
    op.drop_table("agent_jobs")
