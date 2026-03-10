"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { customFetch } from "@/api/mutator";
import { cn } from "@/lib/utils";
import { FileText, Folder } from "lucide-react";

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

interface DocFileListItem {
  filename: string;
  source: string;
  size: number;
  modified: string;
}

interface DocFileRead {
  filename: string;
  source: string;
  path: string;
  content: string;
}

async function listDocs(): Promise<ApiResponse<DocFileListItem[]>> {
  return customFetch<ApiResponse<DocFileListItem[]>>("/api/v1/docs", {
    method: "GET",
  });
}

async function readDoc(
  source: string,
  filename: string,
): Promise<ApiResponse<DocFileRead>> {
  return customFetch<ApiResponse<DocFileRead>>(
    `/api/v1/docs/${encodeURIComponent(source)}/${encodeURIComponent(filename)}`,
    { method: "GET" },
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SOURCE_LABELS: Record<string, string> = {
  docs: "📄 Docs",
  plans: "📋 Plans",
  project: "🏗️ Project",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? `🤖 ${source}`;
}

type SelectedDoc = { source: string; filename: string };

export default function DocsPage() {
  const [files, setFiles] = useState<DocFileListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedDoc | null>(null);
  const [content, setContent] = useState("");
  const [filePath, setFilePath] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDocs()
      .then((result) => {
        if (!cancelled) {
          setFiles(result.data);
          if (result.data.length > 0) {
            const first = result.data[0];
            handleSelectFile(first.source, first.filename);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load docs.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectFile = useCallback(
    async (source: string, filename: string) => {
      setSelected({ source, filename });
      setError(null);
      setIsLoadingContent(true);
      try {
        const result = await readDoc(source, filename);
        setContent(result.data.content);
        setFilePath(result.data.path);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load file.",
        );
        setContent("");
      } finally {
        setIsLoadingContent(false);
      }
    },
    [],
  );

  // Group files by source
  const grouped = files.reduce<Record<string, DocFileListItem[]>>(
    (acc, file) => {
      if (!acc[file.source]) acc[file.source] = [];
      acc[file.source].push(file);
      return acc;
    },
    {},
  );

  const isSelected = (source: string, filename: string) =>
    selected?.source === source && selected?.filename === filename;

  return (
    <DashboardPageLayout
      signedOut={{
        message: "Sign in to view docs.",
        forceRedirectUrl: "/docs",
        signUpForceRedirectUrl: "/docs",
      }}
      title="Docs"
    >
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-72 shrink-0 space-y-3">
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
              Loading…
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
              No docs yet
            </div>
          ) : (
            Object.entries(grouped).map(([source, sourceFiles]) => (
              <div
                key={source}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                  <Folder className="h-3.5 w-3.5 text-slate-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {sourceLabel(source)}
                  </h3>
                  <span className="ml-auto text-[10px] text-slate-400">
                    {sourceFiles.length}
                  </span>
                </div>
                <div className="p-1.5 space-y-0.5">
                  {sourceFiles.map((file) => (
                    <button
                      key={`${file.source}/${file.filename}`}
                      type="button"
                      onClick={() =>
                        void handleSelectFile(file.source, file.filename)
                      }
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition",
                        isSelected(file.source, file.filename)
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <FileText
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          isSelected(file.source, file.filename)
                            ? "text-slate-400"
                            : "text-slate-400",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">
                          {file.filename.replace(/\.md$/, "")}
                        </div>
                        <div
                          className={cn(
                            "text-[10px]",
                            isSelected(file.source, file.filename)
                              ? "text-slate-400"
                              : "text-slate-400",
                          )}
                        >
                          {formatSize(file.size)} · {formatDate(file.modified)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          {selected ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    {selected.filename}
                  </h2>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {sourceLabel(selected.source)}
                  </span>
                </div>
                {filePath && (
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
                    {filePath}
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
          ) : !isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
              Select a document to view
            </div>
          ) : null}
        </div>
      </div>
    </DashboardPageLayout>
  );
}
