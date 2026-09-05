"use client";

import { useEffect, useState } from "react";
import { X, History, RotateCcw, Loader2, User as UserIcon, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

type Version = {
  id: string;
  version: number;
  editedAt: string;
  changeNote: string | null;
  stepCount: number;
  editedBy: { id: string; name: string; designation: string | null };
};

export function VersionHistoryDrawer({
  definitionId,
  open,
  onClose,
  onRestored
}: {
  definitionId: string;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/workflow/definitions/${definitionId}/versions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => { if (!cancelled) setVersions(j.versions ?? []); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [definitionId, open]);

  async function restore(versionId: string, version: number) {
    if (!confirm(`Restore the workflow to version ${version}? This will replace the current steps and create a new audit entry.`)) return;
    setRestoringId(versionId);
    try {
      const r = await fetch(`/api/workflow/definitions/${definitionId}/restore/${versionId}`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Restore failed");
        return;
      }
      onRestored();
    } finally {
      setRestoringId(null);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-screen w-[420px] bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-500" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Version history</div>
              <div className="text-[11px] text-slate-500">Every save is captured. Restore rolls the workflow back.</div>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" title="Close" className="h-auto w-auto p-0 text-slate-400 hover:bg-transparent hover:text-slate-600" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-center py-8 text-sm text-slate-500 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          )}
          {error && <Alert variant="destructive" className="text-sm text-rose-600 p-3 bg-rose-50 border border-rose-200 rounded-md">{error}</Alert>}
          {!loading && !error && versions.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-500">
              <History size={28} className="mx-auto text-slate-300 mb-2" />
              <p>No version history yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">The next save will start the audit trail.</p>
            </div>
          )}

          <ol className="space-y-3">
            {versions.map((v, i) => {
              const isCurrent = i === 0;
              return (
                <li
                  key={v.id}
                  className={cn(
                    "rounded-md border p-3",
                    isCurrent ? "border-primary-300 bg-primary-50/40" : "border-slate-200 bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900">v{v.version}</span>
                        {isCurrent && (
                          <span className="text-[9px] uppercase font-bold tracking-wider text-primary-700 bg-primary-100 rounded px-1.5 py-0.5">Current</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{formatDateTime(v.editedAt)}</div>
                    </div>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restoringId === v.id}
                        onClick={() => restore(v.id, v.version)}
                      >
                        {restoringId === v.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Restore
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                    <span className="flex items-center gap-1"><UserIcon size={11} /> {v.editedBy?.name ?? "—"}</span>
                    <span className="flex items-center gap-1"><Layers size={11} /> {v.stepCount} step{v.stepCount === 1 ? "" : "s"}</span>
                  </div>

                  {v.changeNote && (
                    <p className="text-xs text-slate-700 mt-2 leading-snug">{v.changeNote}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </>
  );
}
