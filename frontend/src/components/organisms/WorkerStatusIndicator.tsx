"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, Power, PowerOff } from "lucide-react";
import { customFetch } from "@/api/mutator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/clerk";

interface WorkerHealth {
  running: boolean;
  pid: number | null;
  total_queued: number;
  total_running: number;
  total_failed: number;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

async function fetchHealth(): Promise<WorkerHealth | null> {
  try {
    const res = await customFetch<ApiResponse<WorkerHealth>>(
      "/api/v1/agent-jobs/worker-health",
      { method: "GET" },
    );
    return res.data;
  } catch {
    return null;
  }
}

async function controlWorker(action: "start" | "stop"): Promise<boolean> {
  try {
    const res = await customFetch<ApiResponse<{ ok: boolean }>>(
      `/api/v1/agent-jobs/worker/${action}`,
      { method: "POST" },
    );
    return res.data?.ok ?? false;
  } catch {
    return false;
  }
}

export function WorkerStatusIndicator() {
  const { isSignedIn } = useAuth();
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [acting, setActing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    const h = await fetchHealth();
    setHealth(h);
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    void refresh();
    const iv = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(iv);
  }, [isSignedIn, refresh]);

  if (!isSignedIn || health === null) return null;

  const handleToggle = async () => {
    setActing(true);
    const action = health.running ? "stop" : "start";
    await controlWorker(action);
    // Give systemd a moment
    await new Promise((r) => setTimeout(r, 1500));
    await refresh();
    setActing(false);
  };

  const totalJobs = health.total_queued + health.total_running + health.total_failed;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
          health.running
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
        )}
        title={health.running ? `Worker running (PID ${health.pid})` : "Worker stopped"}
      >
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            health.running ? "bg-emerald-500 animate-pulse" : "bg-rose-500",
          )}
        />
        <Activity className="h-3.5 w-3.5" />
        {totalJobs > 0 && (
          <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-bold shadow-sm">
            {totalJobs}
          </span>
        )}
      </button>

      {expanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setExpanded(false)}
          />
          {/* Popover */}
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Job Worker</h3>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  health.running
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700",
                )}
              >
                {health.running ? "Running" : "Stopped"}
              </span>
            </div>

            {health.pid && (
              <p className="mb-2 text-[11px] text-slate-500">PID {health.pid}</p>
            )}

            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold text-slate-900">{health.total_queued}</p>
                <p className="text-[10px] text-slate-500">Queued</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold text-emerald-600">{health.total_running}</p>
                <p className="text-[10px] text-slate-500">Running</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold text-rose-600">{health.total_failed}</p>
                <p className="text-[10px] text-slate-500">Failed</p>
              </div>
            </div>

            <button
              type="button"
              disabled={acting}
              onClick={() => void handleToggle()}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition",
                health.running
                  ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                acting && "opacity-50",
              )}
            >
              {acting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : health.running ? (
                <PowerOff className="h-3.5 w-3.5" />
              ) : (
                <Power className="h-3.5 w-3.5" />
              )}
              {health.running ? "Stop Worker" : "Start Worker"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
