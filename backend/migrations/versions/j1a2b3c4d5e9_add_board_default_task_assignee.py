"""Add default_task_assignee_id to boards.

Revision ID: j1a2b3c4d5e9
Revises: i1a2b3c4d5e8
Create Date: 2026-03-10 11:22:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "j1a2b3c4d5e9"
down_revision = "i1a2b3c4d5e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("boards", sa.Column("default_task_assignee_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_boards_default_task_assignee_id",
        "boards",
        "agents",
        ["default_task_assignee_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_boards_default_task_assignee_id",
        "boards",
        ["default_task_assignee_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_boards_default_task_assignee_id", table_name="boards")
    op.drop_constraint("fk_boards_default_task_assignee_id", "boards", type_="foreignkey")
    op.drop_column("boards", "default_task_assignee_id")
