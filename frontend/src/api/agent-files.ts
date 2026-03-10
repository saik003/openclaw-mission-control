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

// ── Memory diary (read-only) ──

export interface MemoryFileListItem {
  filename: string;
  size: number;
  modified: string;
}

export interface MemoryFileRead {
  filename: string;
  content: string;
}

export async function listMemoryFiles(
  agentId: string,
): Promise<ApiResponse<MemoryFileListItem[]>> {
  return customFetch<ApiResponse<MemoryFileListItem[]>>(
    `/api/v1/agents/${agentId}/files/memory`,
    { method: "GET" },
  );
}

export async function readMemoryFile(
  agentId: string,
  filename: string,
): Promise<ApiResponse<MemoryFileRead>> {
  return customFetch<ApiResponse<MemoryFileRead>>(
    `/api/v1/agents/${agentId}/files/memory/${encodeURIComponent(filename)}`,
    { method: "GET" },
  );
}

// ── Shared docs (read-only) ──

export async function listDocsFiles(
  agentId: string,
): Promise<ApiResponse<MemoryFileListItem[]>> {
  return customFetch<ApiResponse<MemoryFileListItem[]>>(
    `/api/v1/agents/${agentId}/files/docs`,
    { method: "GET" },
  );
}

export async function readDocsFile(
  agentId: string,
  filename: string,
): Promise<ApiResponse<MemoryFileRead>> {
  return customFetch<ApiResponse<MemoryFileRead>>(
    `/api/v1/agents/${agentId}/files/docs/${encodeURIComponent(filename)}`,
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
