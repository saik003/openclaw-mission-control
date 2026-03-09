# ruff: noqa: INP001
"""Unit tests for the AgentBoard many-to-many model."""

from uuid import uuid4

from app.models.agent_boards import AgentBoard


def test_agent_board_create_with_defaults() -> None:
    """AgentBoard should initialise with sensible defaults."""
    agent_id = uuid4()
    board_id = uuid4()

    ab = AgentBoard(agent_id=agent_id, board_id=board_id)

    assert ab.agent_id == agent_id
    assert ab.board_id == board_id
    assert ab.role == "worker"
    assert ab.is_primary is False
    assert ab.id is not None
    assert ab.created_at is not None


def test_agent_board_create_as_lead() -> None:
    """AgentBoard should accept explicit role and primary flag."""
    ab = AgentBoard(
        agent_id=uuid4(),
        board_id=uuid4(),
        role="lead",
        is_primary=True,
    )

    assert ab.role == "lead"
    assert ab.is_primary is True


def test_agent_board_unique_constraint_declared() -> None:
    """The model should declare a unique constraint on (agent_id, board_id)."""
    constraints = AgentBoard.__table_args__
    assert any(
        getattr(c, "name", None) == "uq_agent_board"
        for c in (constraints if isinstance(constraints, tuple) else [constraints])
    ), "Expected UniqueConstraint 'uq_agent_board' in __table_args__"


def test_agent_board_table_name() -> None:
    """Table name should be 'agent_boards'."""
    assert AgentBoard.__tablename__ == "agent_boards"


def test_agent_board_ids_are_unique() -> None:
    """Each instantiation should get a unique id."""
    ab1 = AgentBoard(agent_id=uuid4(), board_id=uuid4())
    ab2 = AgentBoard(agent_id=uuid4(), board_id=uuid4())
    assert ab1.id != ab2.id
