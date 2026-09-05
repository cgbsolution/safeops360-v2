"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";

// ── Category vocabulary ────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "CONTROL_EVIDENCE", label: "Control Evidence" },
  { value: "TEST_WORKPAPER", label: "Test Workpaper" },
  { value: "REVIEW_EVIDENCE", label: "Review Evidence" },
  { value: "OTHER", label: "Other" },
] as const;

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

// ── Client-side validation ─────────────────────────────────────────────────────
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
// Extension → canonical mime (accepted set). We validate on extension because
// browsers report inconsistent mime types (e.g. .msg, .csv, .docx).
const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  msg: "application/vnd.ms-outlook",
};
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt,.msg";

type AttachmentRow = {
  id: string;
  controlId: string;
  category: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caption: string | null;
  uploadedAt: string;
  uploadedById: string;
  uploadedBy?: { id: string; name: string } | null;
};

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function fmtSize(bytes: number): string {
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function iconFor(mimeType: string, fileName: string) {
  const ext = extOf(fileName);
  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) return ImageIcon;
  if (mimeType.includes("spreadsheet") || ext === "xlsx" || ext === "csv") return FileSpreadsheet;
  return FileText;
}

export function ControlAttachments({ controlId, canEdit }: { controlId: string; canEdit: boolean }) {
  const [items, setItems] = useState<AttachmentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageDisabled, setStorageDisabled] = useState(false);

  const [category, setCategory] = useState<string>("CONTROL_EVIDENCE");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/erm/controls/${controlId}/attachments`);
      if (res.status === 503) {
        setStorageDisabled(true);
        setItems([]);
        return;
      }
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((j && (j.detail || j.error)) || `Failed to load (${res.status}).`);
      }
      const rows: AttachmentRow[] = Array.isArray(j) ? j : j?.items ?? [];
      setStorageDisabled(false);
      setItems(rows);
    } catch (e: any) {
      setLoadError(e?.message ?? "Could not load documents.");
      setItems([]);
    }
  }, [controlId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadFile(file: File) {
    setUploadError(null);

    // ── Client-side validation ──
    const ext = extOf(file.name);
    if (!ALLOWED[ext]) {
      setUploadError(
        `"${file.name}" is not an allowed type. Accepted: PDF, PNG, JPEG, WEBP, DOCX, XLSX, CSV, TXT, MSG.`,
      );
      return;
    }
    if (file.size > MAX_SIZE) {
      setUploadError(`"${file.name}" is ${fmtSize(file.size)} — the maximum is 25 MB.`);
      return;
    }

    const mimeType = file.type || ALLOWED[ext] || "application/octet-stream";
    setUploading(true);
    try {
      // Phase 1 — init: signed upload URL
      const initRes = await fetch(`/api/erm/controls/${controlId}/attachments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phase: "init",
          category,
          fileName: file.name,
          fileSize: file.size,
          mimeType,
        }),
      });
      if (initRes.status === 503) {
        setStorageDisabled(true);
        setUploading(false);
        return;
      }
      const initJson = await initRes.json().catch(() => ({}));
      if (!initRes.ok) {
        throw new Error(initJson.detail || initJson.error || `Init failed (${initRes.status}).`);
      }

      // Phase 2 — direct PUT of raw bytes to Supabase
      const putRes = await fetch(initJson.uploadUrl, {
        method: "PUT",
        headers: { "content-type": mimeType },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status}).`);

      // Phase 3 — complete: finalise metadata
      const completeRes = await fetch(`/api/erm/controls/${controlId}/attachments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phase: "complete",
          attachmentId: initJson.attachmentId,
          caption: null,
        }),
      });
      const completeJson = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) {
        throw new Error(completeJson.detail || completeJson.error || "Could not finalise upload.");
      }

      await load();
    } catch (e: any) {
      setUploadError(e?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list);
    for (const f of files) {
      // Sequential so the uploading state and validation errors stay coherent.
      // eslint-disable-next-line no-await-in-loop
      await uploadFile(f);
    }
  }

  async function download(att: AttachmentRow) {
    setUploadError(null);
    try {
      const res = await fetch(`/api/erm/controls/${controlId}/attachments/${att.id}/download?inline=0`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.url) {
        throw new Error(j.detail || j.error || "Could not get a download link.");
      }
      window.open(j.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setUploadError(e?.message ?? "Download failed.");
    }
  }

  async function remove(att: AttachmentRow) {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${att.fileName}"?`)) return;
    setBusyId(att.id);
    setUploadError(null);
    try {
      const res = await fetch(`/api/erm/controls/${controlId}/attachments/${att.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || j.error || `Delete failed (${res.status}).`);
      }
      setItems((prev) => (prev ? prev.filter((it) => it.id !== att.id) : prev));
    } catch (e: any) {
      setUploadError(e?.message ?? "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  // ── Storage not configured ──
  if (storageDisabled) {
    return (
      <Alert variant="warning" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        File storage is not configured in this environment.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Uploader */}
      {canEdit && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="mb-1 block text-[11px] font-medium text-slate-600">Document type</Label>
              <SelectField
                value={category}
                onChange={setCategory}
                disabled={uploading}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                options={CATEGORIES.map((c) => ({ value: c.value, label: `${c.label}` }))}
              />
            </div>
          </div>

          <div
            onDragEnter={(e) => {
              e.preventDefault();
              if (!uploading) setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!uploading && e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
            }}
            className={
              "rounded-lg border-2 border-dashed px-4 py-6 text-center transition " +
              (dragOver ? "border-primary-500 bg-primary-50/40" : "border-slate-300 bg-slate-50")
            }
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-primary-700">
                <Loader2 size={16} className="animate-spin" /> Uploading…
              </div>
            ) : (
              <>
                <Upload size={20} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Drag &amp; drop a file here</p>
                <Button variant="outline"
                  type="button"
                  onClick={() => fileInputRef.current?.click()} className="mt-3 gap-1.5 rounded-md px-3 py-1.5 text-xs">
                  <Upload size={13} /> Choose file
                </Button>
                <p className="mt-2 text-[11px] text-slate-500">
                  PDF · PNG · JPEG · WEBP · DOCX · XLSX · CSV · TXT · MSG · up to 25 MB
                </p>
              </>
            )}
            <Input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleFiles(e.target.files);
                e.target.value = "";
              }} />
          </div>

          {uploadError && (
            <Alert variant="destructive" className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <AlertCircle size={14} className="shrink-0" /> {uploadError}
            </Alert>
          )}
        </div>
      )}

      {/* Non-editors still see errors (e.g. from download) */}
      {!canEdit && uploadError && (
        <Alert variant="destructive" className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertCircle size={14} className="shrink-0" /> {uploadError}
        </Alert>
      )}

      {/* List */}
      {loadError ? (
        <Alert variant="destructive" className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertCircle size={14} className="shrink-0" /> {loadError}
        </Alert>
      ) : items === null ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading documents…
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-200 py-8 text-center shadow-none">
          <Paperclip size={20} className="text-slate-300" />
          <p className="text-sm text-slate-500">No documents attached yet.</p>
          {canEdit && <p className="text-[11px] text-slate-400">Upload evidence, workpapers or review documents above.</p>}
        </Card>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {items.map((att) => {
            const Icon = iconFor(att.mimeType, att.fileName);
            return (
              <li key={att.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500">
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800" title={att.fileName}>
                      {att.fileName}
                    </span>
                    <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {CATEGORY_LABEL[att.category] ?? att.category}
                    </span>
                  </div>
                  {att.caption && <p className="mt-0.5 truncate text-xs text-slate-500">{att.caption}</p>}
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {fmtSize(att.fileSize)}
                    {" · "}
                    {att.uploadedBy?.name ?? "Unknown"}
                    {" · "}
                    {fmtDate(att.uploadedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline"
                    type="button"
                    onClick={() => void download(att)} className="gap-1 rounded-md px-2 py-1 text-[11px]">
                    <Download size={12} /> Download
                  </Button>
                  {canEdit && (
                    <Button variant="outline"
                      type="button"
                      onClick={() => void remove(att)}
                      disabled={busyId === att.id} className="rounded-md p-1.5"
                      aria-label="Delete document">
                      {busyId === att.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
