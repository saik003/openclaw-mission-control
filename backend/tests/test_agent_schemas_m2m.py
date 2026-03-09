# ruff: noqa: INP001
"""Schema validation tests for agent M2M board fields (AgentCreate, AgentUpdate, AgentRead)."""

from uuid import UUID, uuid4

import pytest

from app.schemas.agents import AgentCreate, AgentRead, AgentUpdate


# ---------------------------------------------------------------------------
# AgentCreate
# ---------------------------------------------------------------------------

class TestAgentCreateBoardIds:
    """Tests for AgentCreate board_ids and resolved_board_ids()."""

    def test_board_ids_list(self) -> None:
        """AgentCreate should accept a list of board UUIDs."""
        b1, b2 = uuid4(), uuid4()
        agent = AgentCreate(name="test", board_ids=[b1, b2])
        assert agent.board_ids == [b1, b2]

    def test_board_ids_single_uuid_coerced_to_list(self) -> None:
        """A single UUID in board_ids should be coerced to a list."""
        b1 = uuid4()
        agent = AgentCreate(name="test", board_ids=b1)  # type: ignore[arg-type]
        assert agent.board_ids == [b1]

    def test_board_ids_single_string_coerced_to_list(self) -> None:
        """A single UUID string in board_ids should be coerced to a list."""
        b1 = uuid4()
        agent = AgentCreate(name="test", board_ids=str(b1))  # type: ignore[arg-type]
        assert agent.board_ids == [b1]

    def test_resolved_board_ids_from_board_ids(self) -> None:
        """resolved_board_ids() should return board_ids when present."""
        b1, b2 = uuid4(), uuid4()
        agent = AgentCreate(name="test", board_ids=[b1, b2])
        assert agent.resolved_board_ids() == [b1, b2]

    def test_resolved_board_ids_fallback_to_legacy_board_id(self) -> None:
        """resolved_board_ids() should fall back to board_id when board_ids absent."""
        b1 = uuid4()
        agent = AgentCreate(name="test", board_id=b1)
        assert agent.resolved_board_ids() == [b1]

    def test_resolved_board_ids_empty_when_nothing_set(self) -> None:
        """resolved_board_ids() should return [] when neither field is set."""
        agent = AgentCreate(name="test")
        assert agent.resolved_board_ids() == []

    def test_board_ids_takes_precedence_over_board_id(self) -> None:
        """When both board_ids and board_id are provided, board_ids wins."""
        legacy = uuid4()
        b1, b2 = uuid4(), uuid4()
        agent = AgentCreate(name="test", board_id=legacy, board_ids=[b1, b2])
        assert agent.resolved_board_ids() == [b1, b2]

    def test_retrocompat_board_id_only(self) -> None:
        """Legacy callers sending only board_id should still work."""
        b1 = uuid4()
        agent = AgentCreate(name="test", board_id=b1)
        assert agent.board_id == b1
        assert agent.board_ids is None
        assert agent.resolved_board_ids() == [b1]


# ---------------------------------------------------------------------------
# AgentUpdate
# ---------------------------------------------------------------------------

class TestAgentUpdateBoardIds:
    """Tests for AgentUpdate M2M fields."""

    def test_board_ids_field(self) -> None:
        """AgentUpdate should accept board_ids list."""
        b1, b2 = uuid4(), uuid4()
        update = AgentUpdate(board_ids=[b1, b2])
        assert update.board_ids == [b1, b2]

    def test_primary_board_id_field(self) -> None:
        """AgentUpdate should accept primary_board_id."""
        b1 = uuid4()
        update = AgentUpdate(primary_board_id=b1)
        assert update.primary_board_id == b1

    def test_legacy_board_id_still_accepted(self) -> None:
        """AgentUpdate should still accept legacy board_id."""
        b1 = uuid4()
        update = AgentUpdate(board_id=b1)
        assert update.board_id == b1

    def test_all_board_fields_together(self) -> None:
        """AgentUpdate should handle all board fields simultaneously."""
        b1, b2 = uuid4(), uuid4()
        update = AgentUpdate(board_id=b1, board_ids=[b1, b2], primary_board_id=b1)
        assert update.board_id == b1
        assert update.board_ids == [b1, b2]
        assert update.primary_board_id == b1

    def test_defaults_are_none(self) -> None:
        """All optional fields should default to None."""
        update = AgentUpdate()
        assert update.board_id is None
        assert update.board_ids is None
        assert update.primary_board_id is None


# ---------------------------------------------------------------------------
# AgentRead
# ---------------------------------------------------------------------------

class TestAgentReadSerialization:
    """Tests for AgentRead M2M serialization."""

    def _make_agent_read(self, **overrides) -> AgentRead:  # noqa: ANN003
        defaults = {
            "id": uuid4(),
            "gateway_id": uuid4(),
            "name": "Test Agent",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
        }
        defaults.update(overrides)
        return AgentRead(**defaults)

    def test_board_ids_default_empty(self) -> None:
        """AgentRead should default board_ids to empty list."""
        agent = self._make_agent_read()
        assert agent.board_ids == []

    def test_primary_board_id_default_none(self) -> None:
        """AgentRead should default primary_board_id to None."""
        agent = self._make_agent_read()
        assert agent.primary_board_id is None

    def test_board_ids_populated(self) -> None:
        """AgentRead should carry board_ids when provided."""
        b1, b2 = uuid4(), uuid4()
        agent = self._make_agent_read(board_ids=[b1, b2])
        assert agent.board_ids == [b1, b2]

    def test_primary_board_id_populated(self) -> None:
        """AgentRead should carry primary_board_id when provided."""
        b1 = uuid4()
        agent = self._make_agent_read(primary_board_id=b1)
        assert agent.primary_board_id == b1

    def test_serialization_includes_m2m_fields(self) -> None:
        """JSON serialization should include board_ids and primary_board_id."""
        b1, b2 = uuid4(), uuid4()
        agent = self._make_agent_read(board_ids=[b1, b2], primary_board_id=b1)
        data = agent.model_dump()
        assert "board_ids" in data
        assert "primary_board_id" in data
        assert data["board_ids"] == [b1, b2]
        assert data["primary_board_id"] == b1

    def test_legacy_fields_still_present(self) -> None:
        """AgentRead should still include legacy board_id and is_board_lead."""
        b1 = uuid4()
        agent = self._make_agent_read(board_id=b1, is_board_lead=True)
        assert agent.board_id == b1
        assert agent.is_board_lead is True
