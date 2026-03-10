"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type MemoryFileListItem,
  listMemoryFiles,
  readMemoryFile,
} from "@/api/agent-files";
import { cn } from "@/lib/utils";

type AgentMemoryDiaryProps = {
  agentId: string;
};

function formatDate(filename: string): string {
  // Extract date from filenames like "2026-03-10.md" or "2026-03-09-pmo-startup.md"
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return filename.replace(/\.md$/, "");
  const date = new Date(match[1] + "T12:00:00Z");
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatLabel(filename: string): string {
  // "2026-03-10.md" → "10 Mar" | "2026-03-09-pmo-startup.md" → "9 Mar · pmo-startup"
  const base = filename.replace(/\.md$/, "");
  const match = base.match(/^(\d{4})-(\d{2})-(\d{2})(?:-(.+))?$/);
  if (!match) return base;
  const day = parseInt(match[3], 10);
  const monthNames = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  const month = monthNames[parseInt(match[2], 10) - 1] ?? match[2];
  const suffix = match[4] ? ` · ${match[4]}` : "";
  return `${day} ${month}${suffix}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function AgentMemoryDiary({ agentId }: AgentMemoryDiaryProps) {
  const [files, setFiles] = useState<MemoryFileListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listMemoryFiles(agentId)
      .then((result) => {
        if (!cancelled) {
          setFiles(result.data);
          // Auto-select the first (newest) file
          if (result.data.length > 0 && !selectedFile) {
            handleSelectFile(result.data[0].filename);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load memory files.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const handleSelectFile = useCallback(
    async (filename: string) => {
      setSelectedFile(filename);
      setError(null);
      setIsLoadingContent(true);
      try {
        const result = await readMemoryFile(agentId, filename);
        setContent(result.data.content);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load file.",
        );
        setContent("");
      } finally {
        setIsLoadingContent(false);
      }
    },
    [agentId],
  );

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-400">
        Loading memory…
      </div>
    );
  }

  if (files.length === 0 && !error) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
        📭 No memory entries yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        {/* File list — sidebar */}
        <div className="w-48 shrink-0 space-y-1">
          {files.map((file) => (
            <button
              key={file.filename}
              type="button"
              onClick={() => void handleSelectFile(file.filename)}
              className={cn(
                "flex w-full flex-col rounded-lg px-3 py-2 text-left transition",
                selectedFile === file.filename
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100",
              )}
            >
              <span className="text-xs font-semibold">
                {formatLabel(file.filename)}
              </span>
              <span
                className={cn(
                  "text-[10px]",
                  selectedFile === file.filename
                    ? "text-slate-300"
                    : "text-slate-400",
                )}
              >
                {formatSize(file.size)}
              </span>
            </button>
          ))}
        </div>

        {/* Content viewer */}
        <div className="min-w-0 flex-1">
          {selectedFile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono">{selectedFile}</span>
                {files.find((f) => f.filename === selectedFile)?.modified && (
                  <span>
                    ·{" "}
                    {formatDate(selectedFile)}
                  </span>
                )}
              </div>
              {isLoadingContent ? (
                <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
                  Loading…
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">
                    {content}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
              Select an entry to read
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
