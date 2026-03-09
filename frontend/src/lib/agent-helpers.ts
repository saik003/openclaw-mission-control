import type { AgentRead } from "@/api/generated/model";

/**
 * Returns all board IDs an agent belongs to.
 * Prefers the new many-to-many `board_ids` field, falls back to legacy `board_id`.
 */
export function agentBoardIds(agent: AgentRead): string[] {
  return agent.board_ids?.length
    ? agent.board_ids
    : agent.board_id
      ? [agent.board_id]
      : [];
}

/**
 * Returns the agent's primary board ID.
 * Prefers `primary_board_id`, falls back to legacy `board_id`.
 */
export function agentPrimaryBoardId(agent: AgentRead): string | null {
  return agent.primary_board_id ?? agent.board_id ?? null;
}

/**
 * Checks whether an agent belongs to a given board.
 */
export function isAgentOnBoard(agent: AgentRead, boardId: string): boolean {
  return agentBoardIds(agent).includes(boardId);
}
