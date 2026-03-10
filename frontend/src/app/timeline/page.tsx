"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { customFetch } from "@/api/mutator";
import { cn } from "@/lib/utils";
import { Bot, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

interface TimelineEntry {
  agent_id: string;
  agent_name: string;
  filename: string;
  date: string;
  size: number;
  modified: string;
  path: string;
}

interface TimelineEntryContent extends TimelineEntry {
  content: string;
}

async function fetchTimeline(
  date?: string,
): Promise<ApiResponse<TimelineEntry[]>> {
  const qs = date ? `?date=${date}` : "";
  return customFetch<ApiResponse<TimelineEntry[]>>(`/api/v1/timeline${qs}`, {
    method: "GET",
  });
}

async function fetchTimelineEntry(
  agentId: string,
  filename: string,
): Promise<ApiResponse<TimelineEntryContent>> {
  return customFetch<ApiResponse<TimelineEntryContent>>(
    `/api/v1/timeline/${encodeURIComponent(agentId)}/${encodeURIComponent(filename)}`,
    { method: "GET" },
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const AGENT_COLORS: Record<string, string> = {
  main: "bg-purple-100 text-purple-800 border-purple-200",
  pmo: "bg-blue-100 text-blue-800 border-blue-200",
  assistant: "bg-green-100 text-green-800 border-green-200",
};

function agentColorClass(agentId: string): string {
  if (AGENT_COLORS[agentId]) return AGENT_COLORS[agentId];
  // Hash-based color for mc-* agents
  const colors = [
    "bg-amber-100 text-amber-800 border-amber-200",
    "bg-cyan-100 text-cyan-800 border-cyan-200",
    "bg-rose-100 text-rose-800 border-rose-200",
    "bg-indigo-100 text-indigo-800 border-indigo-200",
    "bg-lime-100 text-lime-800 border-lime-200",
    "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    "bg-teal-100 text-teal-800 border-teal-200",
    "bg-orange-100 text-orange-800 border-orange-200",
  ];
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

type SelectedEntry = { agentId: string; filename: string };

export default function TimelinePage() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [allEntries, setAllEntries] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [selected, setSelected] = useState<SelectedEntry | null>(null);
  const [content, setContent] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all entries (for date navigation)
  useEffect(() => {
    fetchTimeline().then((r) => setAllEntries(r.data)).catch(() => {});
  }, []);

  // Load entries for selected date
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setSelected(null);
    setContent("");
    fetchTimeline(date)
      .then((result) => {
        if (!cancelled) {
          setEntries(result.data);
          if (result.data.length > 0) {
            const first = result.data[0];
            handleSelect(first.agent_id, first.filename);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load timeline.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const handleSelect = useCallback(
    async (agentId: string, filename: string) => {
      setSelected({ agentId, filename });
      setError(null);
      setIsLoadingContent(true);
      try {
        const result = await fetchTimelineEntry(agentId, filename);
        setContent(result.data.content);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load entry.",
        );
        setContent("");
      } finally {
        setIsLoadingContent(false);
      }
    },
    [],
  );

  // Available dates from all entries
  const availableDates = useMemo(() => {
    const dates = new Set(allEntries.map((e) => e.date));
    return dates;
  }, [allEntries]);

  const hasPrev = availableDates.size > 0;
  const hasNext = date < todayStr();

  // Unique agents for today
  const agentNames = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => map.set(e.agent_id, e.agent_name));
    return map;
  }, [entries]);

  return (
    <DashboardPageLayout
      signedOut={{
        message: "Sign in to view timeline.",
        forceRedirectUrl: "/timeline",
        signUpForceRedirectUrl: "/timeline",
      }}
      title="Timeline"
    >
      <div className="space-y-4">
        {/* Date navigation */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDate(addDays(date, -1))}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-900">
              {formatDateLabel(date)}
            </span>
            {date === todayStr() && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Hoy
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= todayStr()}
            className={cn(
              "rounded-lg border border-slate-200 p-2 transition",
              date >= todayStr()
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-500 hover:bg-slate-50",
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600"
          />
        </div>

        {/* Agent chips */}
        {agentNames.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(agentNames.entries()).map(([id, name]) => (
              <span
                key={id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  agentColorClass(id),
                )}
              >
                <Bot className="h-3 w-3" />
                {name}
                <span className="opacity-60">
                  ({entries.filter((e) => e.agent_id === id).length})
                </span>
              </span>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-400">
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
            No memory entries for this date
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Entry list */}
            <div className="w-72 shrink-0 space-y-1.5">
              {entries.map((entry) => (
                <button
                  key={`${entry.agent_id}/${entry.filename}`}
                  type="button"
                  onClick={() =>
                    void handleSelect(entry.agent_id, entry.filename)
                  }
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                    selected?.agentId === entry.agent_id &&
                      selected?.filename === entry.filename
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      selected?.agentId === entry.agent_id &&
                        selected?.filename === entry.filename
                        ? "bg-white/20 text-white"
                        : agentColorClass(entry.agent_id),
                    )}
                  >
                    {entry.agent_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">
                      {entry.agent_name}
                    </div>
                    <div
                      className={cn(
                        "truncate text-[10px]",
                        selected?.agentId === entry.agent_id &&
                          selected?.filename === entry.filename
                          ? "text-slate-400"
                          : "text-slate-400",
                      )}
                    >
                      {entry.filename} · {formatSize(entry.size)}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              {selected ? (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                          agentColorClass(selected.agentId),
                        )}
                      >
                        {agentNames.get(selected.agentId)?.charAt(0) ?? "?"}
                      </div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        {agentNames.get(selected.agentId)} — {selected.filename}
                      </h2>
                    </div>
                    {entries.find(
                      (e) =>
                        e.agent_id === selected.agentId &&
                        e.filename === selected.filename,
                    )?.path && (
                      <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
                        {
                          entries.find(
                            (e) =>
                              e.agent_id === selected.agentId &&
                              e.filename === selected.filename,
                          )?.path
                        }
                      </p>
                    )}
                  </div>
                  <div className="p-6">
                    {isLoadingContent ? (
                      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                        Loading…
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700">
                        {content}
                      </pre>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </DashboardPageLayout>
  );
}
