import { describe, it, expect } from "vitest";
import type { AgentRead } from "@/api/generated/model";
import { agentBoardIds, agentPrimaryBoardId, isAgentOnBoard } from "./agent-helpers";

const base: AgentRead = {
  id: "a1",
  name: "Test Agent",
  gateway_id: "g1",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("agentBoardIds", () => {
  it("returns board_ids when present", () => {
    expect(agentBoardIds({ ...base, board_ids: ["b1", "b2"] })).toEqual(["b1", "b2"]);
  });

  it("falls back to board_id when board_ids is empty", () => {
    expect(agentBoardIds({ ...base, board_ids: [], board_id: "b1" })).toEqual(["b1"]);
  });

  it("falls back to board_id when board_ids is undefined", () => {
    expect(agentBoardIds({ ...base, board_id: "b1" })).toEqual(["b1"]);
  });

  it("returns empty array when no board info", () => {
    expect(agentBoardIds(base)).toEqual([]);
  });
});

describe("agentPrimaryBoardId", () => {
  it("prefers primary_board_id", () => {
    expect(agentPrimaryBoardId({ ...base, primary_board_id: "p1", board_id: "b1" })).toBe("p1");
  });

  it("falls back to board_id", () => {
    expect(agentPrimaryBoardId({ ...base, board_id: "b1" })).toBe("b1");
  });

  it("returns null when nothing set", () => {
    expect(agentPrimaryBoardId(base)).toBeNull();
  });
});

describe("isAgentOnBoard", () => {
  it("returns true when agent has board in board_ids", () => {
    expect(isAgentOnBoard({ ...base, board_ids: ["b1", "b2"] }, "b2")).toBe(true);
  });

  it("returns true with legacy board_id", () => {
    expect(isAgentOnBoard({ ...base, board_id: "b1" }, "b1")).toBe(true);
  });

  it("returns false when agent not on board", () => {
    expect(isAgentOnBoard({ ...base, board_ids: ["b1"] }, "b2")).toBe(false);
  });
});
