"use client";

import { useMemo } from "react";
import Link from "next/link";

import type { AgentRead, BoardRead } from "@/api/generated/model";
import { StatusPill } from "@/components/atoms/StatusPill";
import { cn } from "@/lib/utils";

type AgentsHierarchyProps = {
  agents: AgentRead[];
  boards: BoardRead[];
};

/* ─── Helpers ─── */

function agentEmoji(agent: AgentRead): string {
  const profile = agent.identity_profile as Record<string, unknown> | undefined;
  return (typeof profile?.emoji === "string" ? profile.emoji : "") || "🤖";
}

function shortModel(model: string | null | undefined): string {
  if (!model) return "";
  return model.includes("/") ? model.split("/").pop()! : model;
}

type TreeNode = {
  agent: AgentRead;
  children: TreeNode[];
};

function buildTree(agents: AgentRead[]): { roots: TreeNode[]; orphans: AgentRead[] } {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const childrenMap = new Map<string, TreeNode[]>();
  const hasParent = new Set<string>();

  // Initialize children lists
  for (const agent of agents) {
    childrenMap.set(agent.id, []);
  }

  // Build parent-child links
  for (const agent of agents) {
    const parentId = agent.parent_agent_id;
    if (parentId && agentMap.has(parentId)) {
      hasParent.add(agent.id);
      childrenMap.get(parentId)!.push({
        agent,
        children: childrenMap.get(agent.id)!,
      });
    }
  }

  // Sort children: nodes with children first, then alphabetical
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const aHasKids = a.children.length > 0 ? 0 : 1;
      const bHasKids = b.children.length > 0 ? 0 : 1;
      if (aHasKids !== bHasKids) return aHasKids - bHasKids;
      return a.agent.name.localeCompare(b.agent.name);
    });
    for (const node of nodes) sortChildren(node.children);
  };

  // Root agents = no parent (or parent not in list)
  const roots: TreeNode[] = [];
  const orphans: AgentRead[] = [];

  for (const agent of agents) {
    if (!hasParent.has(agent.id)) {
      const children = childrenMap.get(agent.id)!;
      if (children.length > 0 || !agent.parent_agent_id) {
        roots.push({ agent, children });
      } else {
        orphans.push(agent);
      }
    }
  }

  sortChildren(roots);
  return { roots, orphans };
}

/* ─── Sub-components ─── */

function AgentCard({ agent, compact }: { agent: AgentRead; compact?: boolean }) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className={cn(
        "group flex items-center gap-2.5 rounded-xl border bg-white shadow-sm transition",
        "hover:border-slate-300 hover:shadow-md",
        compact ? "px-2.5 py-2" : "px-3.5 py-3",
        agent.status === "active"
          ? "border-emerald-200"
          : agent.status === "offline"
            ? "border-slate-200"
            : "border-amber-200",
      )}
    >
      <span className={compact ? "text-base" : "text-xl"}>{agentEmoji(agent)}</span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-semibold text-slate-900", compact ? "text-xs" : "text-sm")}>
          {agent.name}
        </p>
        {agent.model && (
          <p className="truncate text-[10px] text-slate-400">
            {shortModel(agent.model)}
          </p>
        )}
      </div>
      <StatusPill status={agent.status ?? "unknown"} />
    </Link>
  );
}

function TreeBranch({ node, depth }: { node: TreeNode; depth: number }) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <AgentCard agent={node.agent} compact={depth > 1} />

      {hasChildren && (
        <>
          {/* Vertical connector from parent */}
          <div className="h-5 w-px bg-slate-300" />

          {/* Horizontal connector bar spanning all children */}
          {node.children.length > 1 && (
            <div className="self-stretch px-8">
              <div className="mx-auto h-px bg-slate-300" />
            </div>
          )}

          {/* Children — no wrap, always on same horizontal line */}
          <div className="flex items-start justify-center">
            {node.children.map((child) => (
              <div key={child.agent.id} className="flex flex-col items-center px-3">
                <div className="h-5 w-px bg-slate-300" />
                <TreeBranch node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Main component ─── */

export function AgentsHierarchy({ agents }: AgentsHierarchyProps) {
  const { roots, orphans } = useMemo(() => buildTree(agents), [agents]);

  if (agents.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
        No agents to display.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-8">
      <div className="flex flex-col items-center gap-10">
        {/* Tree roots */}
        {roots.map((root) => (
          <TreeBranch key={root.agent.id} node={root} depth={0} />
        ))}

        {/* Orphans — agents with broken parent reference */}
        {orphans.length > 0 && (
          <div className="flex flex-col items-center">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Unlinked agents
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {orphans.map((agent) => (
                <AgentCard key={agent.id} agent={agent} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
