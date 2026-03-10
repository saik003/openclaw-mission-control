/**
 * Agent workspace files API — reads/writes directly from the filesystem.
 */

import { customFetch } from "./mutator";

export interface AgentFileListItem {
  filename: string;
  exists: boolean;
  size: number;
}

export interface AgentFileRead {
  filename: string;
  content: string;
  exists: boolean;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export async function listAgentFiles(
  agentId: string,
): Promise<ApiResponse<AgentFileListItem[]>> {
  return customFetch<ApiResponse<AgentFileListItem[]>>(
    `/api/v1/agents/${agentId}/files`,
    { method: "GET" },
  );
}

export async function readAgentFile(
  agentId: string,
  filename: string,
): Promise<ApiResponse<AgentFileRead>> {
  return customFetch<ApiResponse<AgentFileRead>>(
    `/api/v1/agents/${agentId}/files/${encodeURIComponent(filename)}`,
    { method: "GET" },
  );
}

export async function writeAgentFile(
  agentId: string,
  filename: string,
  content: string,
): Promise<ApiResponse<AgentFileRead>> {
  return customFetch<ApiResponse<AgentFileRead>>(
    `/api/v1/agents/${agentId}/files/${encodeURIComponent(filename)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
}
