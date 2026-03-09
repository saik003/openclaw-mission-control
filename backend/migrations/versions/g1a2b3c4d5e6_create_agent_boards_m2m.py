"""Create agent_boards many-to-many table and migrate existing data.

Revision ID: g1a2b3c4d5e6
Revises: fa6e83f8d9a1
Create Date: 2026-03-09 20:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "g1a2b3c4d5e6"
down_revision = "a9b1c2d3e4f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- 1. Create agent_boards table --
    op.create_table(
        "agent_boards",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("board_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role",
            sa.String(length=20),
            server_default="worker",
            nullable=False,
        ),
        sa.Column(
            "is_primary",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["agent_id"],
            ["agents.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["board_id"],
            ["boards.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("agent_id", "board_id", name="uq_agent_board"),
    )

    # -- 2. Create indexes --
    op.create_index("ix_agent_boards_agent_id", "agent_boards", ["agent_id"])
    op.create_index("ix_agent_boards_board_id", "agent_boards", ["board_id"])
    op.create_index("ix_agent_boards_role", "agent_boards", ["role"])

    # -- 3. Partial unique index: max 1 lead per board --
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX uq_board_lead "
            "ON agent_boards (board_id) "
            "WHERE role = 'lead'"
        )
    )

    # -- 4. Migrate existing data from agents.board_id --
    op.execute(
        sa.text(
            """
            INSERT INTO agent_boards (agent_id, board_id, role, is_primary, created_at)
            SELECT
                id,
                board_id,
                CASE WHEN is_board_lead THEN 'lead' ELSE 'worker' END,
                true,
                COALESCE(created_at, now())
            FROM agents
            WHERE board_id IS NOT NULL
            """
        )
    )

    # NOTE: board_id and is_board_lead columns in agents are intentionally
    # kept for backward compatibility (dual-write phase).


def downgrade() -> None:
    op.drop_index("uq_board_lead", table_name="agent_boards")
    op.drop_index("ix_agent_boards_role", table_name="agent_boards")
    op.drop_index("ix_agent_boards_board_id", table_name="agent_boards")
    op.drop_index("ix_agent_boards_agent_id", table_name="agent_boards")
    op.drop_table("agent_boards")
