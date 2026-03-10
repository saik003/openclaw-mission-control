/**
 * Board–Agent membership API (batch add/remove).
 *
 * These endpoints manage the agent_boards M2M relationship without triggering
 * gateway reprovisioning — they are pure metadata operations.
 */

import { customFetch } from "./mutator";

export interface BoardAgentsBatchPayload {
  agent_ids: string[];
}

export interface BoardAgentsBatchResult {
  added: string[];
  removed: string[];
  skipped: string[];
}

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * Batch-add existing agents to a board.
 */
export async function addAgentsToBoard(
  boardId: string,
  payload: BoardAgentsBatchPayload,
): Promise<ApiResponse<BoardAgentsBatchResult>> {
  return customFetch<ApiResponse<BoardAgentsBatchResult>>(
    `/api/v1/boards/${boardId}/agents`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Batch-remove agents from a board.
 */
export async function removeAgentsFromBoard(
  boardId: string,
  payload: BoardAgentsBatchPayload,
): Promise<ApiResponse<BoardAgentsBatchResult>> {
  return customFetch<ApiResponse<BoardAgentsBatchResult>>(
    `/api/v1/boards/${boardId}/agents`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}
