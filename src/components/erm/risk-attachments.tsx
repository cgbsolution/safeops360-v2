"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Download,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";

// ── Risk supporting-documents uploader + list ────────────────────────────────
// Two-phase Supabase signed-URL uploader (clone of incidents/multi-file-upload):
//   1) POST …/attachments {phase:"init"}          → { attachmentId, uploadUrl, token }
//   2) PUT uploadUrl (raw file, content-type)      → Supabase
//   3) POST …/attachments {phase:"complete"}       → finalise caption
// List / download / delete via the sibling routes.

type AttachmentRow = {
  id: string;
  category: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caption: string | null;
  uploadedAt: string;
  uploadedBy?: { name: string } | null;
};

type LocalFile = {
  tempId: string;
  attachmentId?: string;
  file: File;
  status: "pending" | "uploading" | "uploaded" | "error";
  errorMessage?: string;
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "SUPPORTING_DOC", label: "Supporting Document" },
  { value: "RISK_EVIDENCE", label: "Risk Evidence" },
  { value: "ASSESSMENT_BASIS", label: "Assessment Basis" },
  { value: "OTHER", label: "Other" },
];
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

// Allowed extensions → representative mime types (used only for client-side gate)
const ALLOWED_EXT = ["pdf", "png", "jpeg", "jpg", "webp", "docx", "xlsx", "csv", "txt", "msg"];
const ACCEPT =
  ".pdf,.png,.jpeg,.jpg,.webp,.docx,.xlsx,.csv,.txt,.msg,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function fmtSize(bytes: number): string {
  const kb = Math.round(bytes / 1024);
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function IconFor({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon size={18} className="text-slate-500" />;
  if (mimeType === "text/csv" || mimeType.includes("spreadsheet")) return <FileSpreadsheet size={18} className="text-slate-500" />;
  return <FileText size={18} className="text-slate-500" />;
}

export function RiskAttachments({ riskId, canEdit = true }: { riskId: string; canEdit?: boolean }) {
  const [items, setItems] = useState<AttachmentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState("SUPPORTING_DOC");
  const [caption, setCaption] = useState("");
  const [uploads, setUploads] = useState<LocalFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setLoadError(null);
    fetch(`/api/erm/risks/${riskId}/attachments`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (cancelled) return;
        const rows: AttachmentRow[] = Array.isArray(j) ? j : j.items ?? [];
        setItems(rows);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [riskId, refreshKey]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError(null);
      const list = Array.from(incoming);
      const accepted: LocalFile[] = [];
      for (const f of list) {
        const ext = extOf(f.name);
        if (!ALLOWED_EXT.includes(ext)) {
          accepted.push({ tempId: crypto.randomUUID(), file: f, status: "error", errorMessage: `Unsupported file type (.${ext || "?"})` });
          continue;
        }
        if (f.size > MAX_SIZE) {
          accepted.push({ tempId: crypto.randomUUID(), file: f, status: "error", errorMessage: `Exceeds ${Math.round(MAX_SIZE / 1024 / 1024)} MB` });
          continue;
        }
        accepted.push({ tempId: crypto.randomUUID(), file: f, status: "pending" });
      }
      setUploads((prev) => [...prev, ...accepted]);
      const cap = caption;
      const cat = category;
      accepted.forEach((af) => {
        if (af.status === "pending") void uploadOne(af, cat, cap);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caption, category, riskId]
  );

  async function uploadOne(local: LocalFile, cat: string, cap: string) {
    setUploads((prev) => prev.map((f) => (f.tempId === local.tempId ? { ...f, status: "uploading" } : f)));
    try {
      // Phase 1 — signed URL
      const initRes = await fetch(`/api/erm/risks/${riskId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "init",
          category: cat,
          fileName: local.file.name,
          fileSize: local.file.size,
          mimeType: local.file.type,
        }),
      });
      if (initRes.status === 503) throw new Error("File storage is not configured in this environment.");
      const initJson = await initRes.json().catch(() => ({}));
      if (!initRes.ok) throw new Error(initJson.detail || initJson.error || "Init failed");

      // Phase 2 — direct PUT to Supabase (mirror multi-file-upload exactly)
      const putRes = await fetch(initJson.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": local.file.type },
        body: local.file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      // Phase 3 — finalise metadata
      const completeRes = await fetch(`/api/erm/risks/${riskId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "complete",
          attachmentId: initJson.attachmentId,
          caption: cap || undefined,
        }),
      });
      const completeJson = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) throw new Error(completeJson.detail || completeJson.error || "Finalise failed");

      setUploads((prev) => prev.map((f) => (f.tempId === local.tempId ? { ...f, status: "uploaded", attachmentId: initJson.attachmentId } : f)));
      // Drop finished rows shortly and refresh the persisted list
      setTimeout(() => {
        setUploads((prev) => prev.filter((f) => f.tempId !== local.tempId));
        setRefreshKey((k) => k + 1);
      }, 600);
    } catch (e: any) {
      setUploads((prev) => prev.map((f) => (f.tempId === local.tempId ? { ...f, status: "error", errorMessage: e?.message ?? "Upload failed" } : f)));
    }
  }

  async function downloadFile(att: AttachmentRow) {
    try {
      const r = await fetch(`/api/erm/risks/${riskId}/attachments/${att.id}/download?inline=0`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail || j.error || "Failed to load");
      if (j.url) window.open(j.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      alert(e?.message ?? "Failed to download");
    }
  }

  async function deleteFile(att: AttachmentRow) {
    if (!confirm(`Delete "${att.fileName}"?`)) return;
    try {
      const r = await fetch(`/api/erm/risks/${riskId}/attachments/${att.id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || j.error || `Failed (${r.status})`);
      }
      setItems((prev) => (prev ? prev.filter((it) => it.id !== att.id) : prev));
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Category</Label>
              <SelectField
                value={category}
                onChange={setCategory}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
                options={CATEGORIES.map((c) => ({ value: c.value, label: `${c.label}` }))}
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <Label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Caption (optional)</Label>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Short description applied to the next upload"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
          </div>

          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            className={
              "rounded-lg border-2 border-dashed px-4 py-6 text-center transition " +
              (dragOver ? "border-primary-500 bg-primary-50/40" : "border-slate-300 bg-slate-50")
            }
          >
            <Upload size={22} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">Drag &amp; drop supporting documents here</p>
            <div className="mt-3">
              <Button variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()} className="gap-1.5 rounded-lg px-3 py-1.5 text-sm">
                <Upload size={13} /> Choose files
              </Button>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }} />
            <p className="mt-2 text-[11px] text-slate-500">PDF / PNG / JPEG / WEBP / DOCX / XLSX / CSV / TXT / MSG · up to 25 MB each</p>
          </div>

          {error && (
            <Alert variant="destructive" className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle size={14} /> {error}
            </Alert>
          )}

          {uploads.length > 0 && (
            <div className="space-y-2">
              {uploads.map((f) => (
                <Card key={f.tempId} className="flex items-center gap-3 rounded-md border bg-white p-2.5 text-sm shadow-none">
                  <FileText size={18} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{f.file.name}</div>
                    <div className="text-[11px] text-slate-500">{fmtSize(f.file.size)}</div>
                  </div>
                  {f.status === "uploading" && (
                    <span className="flex items-center gap-1 text-xs text-primary-700">
                      <Loader2 size={12} className="animate-spin" /> Uploading…
                    </span>
                  )}
                  {f.status === "uploaded" && <span className="text-xs font-medium text-emerald-600">✓ Uploaded</span>}
                  {f.status === "error" && (
                    <span className="flex items-center gap-1 text-xs text-rose-700">
                      <AlertCircle size={12} /> {f.errorMessage ?? "Failed"}
                    </span>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Persisted list */}
      <div>
        {loadError ? (
          <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Failed to load documents: {loadError}</Alert>
        ) : items === null ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading documents…
          </div>
        ) : items.length === 0 ? (
          <Card className="rounded-lg border border-dashed border-slate-200 py-10 text-center shadow-none">
            <FileText size={22} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No supporting documents yet.</p>
          </Card>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {items.map((att) => (
              <li key={att.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100">
                  <IconFor mimeType={att.mimeType} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800" title={att.fileName}>
                      {att.fileName}
                    </span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {CATEGORY_LABELS[att.category] ?? att.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {fmtSize(att.fileSize)} · {fmtWhen(att.uploadedAt)}
                    {att.uploadedBy?.name && <> · {att.uploadedBy.name}</>}
                  </div>
                  {att.caption && <div className="mt-0.5 truncate text-[11px] italic text-slate-600">{att.caption}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline"
                    type="button"
                    onClick={() => downloadFile(att)} className="gap-1 rounded-md px-2 py-1 text-[11px]">
                    <Download size={12} /> Download
                  </Button>
                  {canEdit && (
                    <Button variant="ghost"
                      type="button"
                      onClick={() => deleteFile(att)} className="rounded-md p-1"
                      aria-label="Delete">
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
