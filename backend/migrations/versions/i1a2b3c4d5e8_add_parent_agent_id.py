"""Add parent_agent_id column to agents table for hierarchy.

Revision ID: i1a2b3c4d5e8
Revises: h1a2b3c4d5e7
Create Date: 2026-03-10 09:53:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "i1a2b3c4d5e8"
down_revision = "h1a2b3c4d5e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("parent_agent_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_agents_parent_agent_id",
        "agents",
        "agents",
        ["parent_agent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_agents_parent_agent_id", "agents", ["parent_agent_id"])


def downgrade() -> None:
    op.drop_index("ix_agents_parent_agent_id", table_name="agents")
    op.drop_constraint("fk_agents_parent_agent_id", "agents", type_="foreignkey")
    op.drop_column("agents", "parent_agent_id")
