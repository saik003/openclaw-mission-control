"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { customFetch } from "@/api/mutator";
import { cn } from "@/lib/utils";
import { Bot, Clock3, PlayCircle, RefreshCw, TriangleAlert } from "lucide-react";

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

interface AgentJobRead {
  id: string;
  agent_id: string;
  board_id: string;
  task_id?: string | null;
  webhook_id?: string | null;
  payload_id?: string | null;
  trigger_type: string;
  title: string;
  instructions?: string | null;
  status: string;
  priority: number;
  lock_key?: string | null;
  attempt_count: number;
  max_attempts: number;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
}

interface AgentWorkloadRead {
  agent_id: string;
  agent_name: string;
  agent_model?: string | null;
  running: AgentJobRead[];
  queued: AgentJobRead[];
  failed: AgentJobRead[];
}

interface WorkerHealth {
  running: boolean;
  pid: number | null;
  total_queued: number;
  total_running: number;
  total_failed: number;
}

async function listWorkload(): Promise<ApiResponse<AgentWorkloadRead[]>> {
  return customFetch<ApiResponse<AgentWorkloadRead[]>>("/api/v1/agent-jobs/workload", {
    method: "GET",
  });
}

async function fetchWorkerHealth(): Promise<ApiResponse<WorkerHealth>> {
  return customFetch<ApiResponse<WorkerHealth>>("/api/v1/agent-jobs/worker-health", {
    method: "GET",
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function JobCard({ job, tone = "queued" }: { job: AgentJobRead; tone?: "running" | "queued" | "failed" }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 shadow-sm",
        tone === "running" && "border-emerald-200 bg-emerald-50",
        tone === "queued" && "border-slate-200 bg-white",
        tone === "failed" && "border-rose-200 bg-rose-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{job.title}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {job.trigger_type} · prio {job.priority}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {job.status}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-slate-500">
        <p>Creado: {formatDate(job.created_at)}</p>
        {job.started_at ? <p>Iniciado: {formatDate(job.started_at)}</p> : null}
        {job.lock_key ? <p className="font-mono">Lock: {job.lock_key}</p> : null}
        {job.error_message ? <p className="text-rose-600">{job.error_message}</p> : null}
      </div>
    </div>
  );
}

export default function WorkloadPage() {
  const [workload, setWorkload] = useState<AgentWorkloadRead[]>([]);
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [wl, wh] = await Promise.all([listWorkload(), fetchWorkerHealth()]);
      setWorkload(wl.data);
      setHealth(wh.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => setIsLoading(false));
    const iv = setInterval(() => void loadData(), 10_000);
    return () => clearInterval(iv);
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const activeAgents = useMemo(
    () => workload.filter((w) => w.running.length || w.queued.length || w.failed.length),
    [workload],
  );

  return (
    <DashboardPageLayout
      signedOut={{
        message: "Sign in to view workload.",
        forceRedirectUrl: "/workload",
        signUpForceRedirectUrl: "/workload",
      }}
      title="Workload"
      description="Kanban operativo por agente: running + queued + failed."
      headerActions={
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
      }
    >
      {/* Worker status bar */}
      {health && (
        <div
          className={cn(
            "mb-4 flex items-center gap-4 rounded-xl border px-4 py-3 text-sm",
            health.running
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block h-2.5 w-2.5 rounded-full",
                health.running ? "bg-emerald-500 animate-pulse" : "bg-rose-500",
              )}
            />
            <span className="font-semibold">
              Worker: {health.running ? "Running" : "Stopped"}
            </span>
            {health.pid ? (
              <span className="text-xs opacity-60">(PID {health.pid})</span>
            ) : null}
          </div>
          <div className="flex gap-4 text-xs">
            <span>Queued: <strong>{health.total_queued}</strong></span>
            <span>Running: <strong>{health.total_running}</strong></span>
            <span>Failed: <strong>{health.total_failed}</strong></span>
          </div>
        </div>
      )}

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-slate-500">Loading workload…</div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-4">
            {(activeAgents.length ? activeAgents : workload).map((agent) => (
              <section
                key={agent.agent_id}
                className="w-80 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-slate-500" />
                      <h2 className="text-sm font-semibold text-slate-900">
                        {agent.agent_name}
                      </h2>
                    </div>
                    {agent.agent_model ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {agent.agent_model}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                    {agent.running.length + agent.queued.length + agent.failed.length} jobs
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                      <PlayCircle className="h-3.5 w-3.5" /> Running ({agent.running.length})
                    </div>
                    <div className="space-y-2">
                      {agent.running.length ? agent.running.map((job) => <JobCard key={job.id} job={job} tone="running" />) : <p className="text-xs text-slate-400">Sin job en ejecución.</p>}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <Clock3 className="h-3.5 w-3.5" /> Queued ({agent.queued.length})
                    </div>
                    <div className="space-y-2">
                      {agent.queued.length ? agent.queued.map((job) => <JobCard key={job.id} job={job} tone="queued" />) : <p className="text-xs text-slate-400">Cola vacía.</p>}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-rose-700">
                      <TriangleAlert className="h-3.5 w-3.5" /> Failed ({agent.failed.length})
                    </div>
                    <div className="space-y-2">
                      {agent.failed.length ? agent.failed.map((job) => <JobCard key={job.id} job={job} tone="failed" />) : <p className="text-xs text-slate-400">Sin errores.</p>}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </DashboardPageLayout>
  );
}
