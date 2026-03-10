"""Add model column to agents table.

Revision ID: h1a2b3c4d5e7
Revises: g1a2b3c4d5e6
Create Date: 2026-03-10 08:35:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "h1a2b3c4d5e7"
down_revision = "g1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("model", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("agents", "model")
