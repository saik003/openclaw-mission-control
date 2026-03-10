"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type AgentFileListItem,
  listAgentFiles,
  readAgentFile,
  writeAgentFile,
} from "@/api/agent-files";
import { cn } from "@/lib/utils";

type AgentFilesEditorProps = {
  agentId: string;
};

const FILE_ICONS: Record<string, string> = {
  "SOUL.md": "🧠",
  "IDENTITY.md": "🪪",
  "AGENTS.md": "📋",
  "TOOLS.md": "🔧",
  "MEMORY.md": "💾",
  "HEARTBEAT.md": "💓",
  "USER.md": "👤",
};

export function AgentFilesEditor({ agentId }: AgentFilesEditorProps) {
  const [files, setFiles] = useState<AgentFileListItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load file list
  useEffect(() => {
    let cancelled = false;
    setIsLoadingFiles(true);
    listAgentFiles(agentId)
      .then((result) => {
        if (!cancelled) setFiles(result.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load files.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  // Load file content
  const handleSelectFile = useCallback(
    async (filename: string) => {
      setSelectedFile(filename);
      setError(null);
      setSaveMessage(null);
      setIsLoadingContent(true);
      try {
        const result = await readAgentFile(agentId, filename);
        setContent(result.data.content);
        setOriginalContent(result.data.content);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load file.",
        );
        setContent("");
        setOriginalContent("");
      } finally {
        setIsLoadingContent(false);
      }
    },
    [agentId],
  );

  // Save file
  const handleSave = useCallback(async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      await writeAgentFile(agentId, selectedFile, content);
      setOriginalContent(content);
      setSaveMessage("Saved");
      // Update file list (size may have changed, or file now exists)
      const result = await listAgentFiles(agentId);
      setFiles(result.data);
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file.");
    } finally {
      setIsSaving(false);
    }
  }, [agentId, content, selectedFile]);

  const hasChanges = content !== originalContent;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Agent files
        </h3>
        {selectedFile && (
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span className="text-xs text-emerald-600">{saveMessage}</span>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || !hasChanges}
              aria-label="Save file"
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1",
                hasChanges
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              )}
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* File tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        {isLoadingFiles ? (
          <span className="text-xs text-slate-400">Loading files…</span>
        ) : (
          files.map((file) => (
            <button
              key={file.filename}
              type="button"
              onClick={() => void handleSelectFile(file.filename)}
              aria-label={`Open file ${file.filename}`}
              aria-pressed={selectedFile === file.filename}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1",
                selectedFile === file.filename
                  ? "bg-slate-900 text-white"
                  : file.exists
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : "bg-white text-slate-400 border border-dashed border-slate-300 hover:border-slate-400",
              )}
            >
              <span>{FILE_ICONS[file.filename] ?? "📄"}</span>
              {file.filename}
            </button>
          ))
        )}
      </div>

      {/* Editor */}
      {selectedFile && (
        <div className="relative">
          {isLoadingContent ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
              Loading…
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSaving}
              className="h-96 w-full resize-y rounded-lg border border-slate-200 bg-white p-4 font-mono text-xs text-slate-800 shadow-sm transition focus-visible:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50"
              placeholder={`Write ${selectedFile} content here…`}
              spellCheck={false}
            />
          )}
          {hasChanges && (
            <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Unsaved changes
            </span>
          )}
        </div>
      )}

      {!selectedFile && !isLoadingFiles && (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
          Select a file to view or edit
        </div>
      )}
    </div>
  );
}
