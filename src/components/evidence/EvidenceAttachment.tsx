"use client";

// EvidenceAttachment — the shared document/evidence upload + list surface
// (spec Stream B §5.2). Generic over any registered entity: pass entityType +
// entityId and it talks to the platform-wide /api/evidence/{type}/{id} two-phase
// signed-URL flow. Drop it into any record detail view.
//
// Generalised from the duplicated {observations,incidents}/multi-file-upload
// pair (their header comment notes they were "duplicated rather than
// generalised") — this is the one both should collapse into over time.
//
// Degrades cleanly when the backend has no storage configured (503) or the user
// can't manage the record (read-only list, no upload zone) — never a broken UI.

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { readApiError } from "@/lib/client-errors";
import { useToast } from "@/components/ui/toast";

// Cross-cutting document classes (mirror app/schemas/attachment.py). The ones
// the AI extraction layer (§6) keys off are SDS / certificate / license.
export const DOCUMENT_CATEGORIES = ["SDS", "certificate", "license", "photo", "report", "other"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

const MAX_SIZE = 25 * 1024 * 1024;
const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.csv,.txt";

export interface AttachmentDTO {
  id: string;
  entityType: string;
  entityId: string;
  category: string;
  documentCategory: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caption: string | null;
  version: number;
  isCurrent: boolean;
  uploadedAt: string;
  uploadedBy?: { id: string; name: string } | null;
}

interface CategoryOption {
  value: string;
  label: string;
}

type Pending = {
  tempId: string;
  fileName: string;
  status: "uploading" | "error";
  error?: string;
};

export function EvidenceAttachment({
  entityType,
  entityId,
  categories,
  showDocumentCategory = true,
  canManage = true,
  accept = DEFAULT_ACCEPT,
  title = "Evidence & documents",
  help,
  slotKey,
}: {
  entityType: string;
  entityId: string;
  categories: CategoryOption[];
  /** Show the cross-cutting SDS/certificate/license/… selector. */
  showDocumentCategory?: boolean;
  canManage?: boolean;
  accept?: string;
  title?: string;
  help?: string;
  /** When set, re-uploads supersede the prior file in this slot (versioning). */
  slotKey?: string;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<AttachmentDTO[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState(categories[0]?.value ?? "");
  const [docCategory, setDocCategory] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const base = `/api/evidence/${entityType}/${entityId}`;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(base);
      if (!res.ok) throw new Error(await readApiError(res, "Could not load attachments"));
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      // Non-fatal: leave the list empty; upload still works.
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const uploadOne = useCallback(
    async (file: File) => {
      const tempId = crypto.randomUUID();
      if (file.size > MAX_SIZE) {
        setPending((p) => [
          ...p,
          { tempId, fileName: file.name, status: "error", error: `Exceeds ${MAX_SIZE / 1024 / 1024} MB` },
        ]);
        return;
      }
      setPending((p) => [...p, { tempId, fileName: file.name, status: "uploading" }]);
      try {
        const initRes = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: "init",
            category,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            documentCategory: docCategory || undefined,
            slotKey: slotKey || undefined,
          }),
        });
        if (!initRes.ok) throw new Error(await readApiError(initRes, "Upload init failed"));
        const init = await initRes.json();

        const putRes = await fetch(init.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);

        const doneRes = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase: "complete", attachmentId: init.attachmentId }),
        });
        if (!doneRes.ok) throw new Error(await readApiError(doneRes, "Finalise failed"));

        setPending((p) => p.filter((x) => x.tempId !== tempId));
        await refresh();
      } catch (e: any) {
        setPending((p) =>
          p.map((x) => (x.tempId === tempId ? { ...x, status: "error", error: e?.message ?? "Upload failed" } : x))
        );
        toast({ variant: "error", title: "Upload failed", description: e?.message ?? "Upload failed" });
      }
    },
    [base, category, docCategory, slotKey, refresh, toast]
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (!category) {
        toast({ variant: "error", title: "Pick a category first" });
        return;
      }
      Array.from(incoming).forEach((f) => void uploadOne(f));
    },
    [category, uploadOne, toast]
  );

  async function download(att: AttachmentDTO) {
    try {
      const res = await fetch(`${base}/${att.id}/download`);
      if (!res.ok) throw new Error(await readApiError(res, "Download failed"));
      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ variant: "error", title: "Download failed", description: e?.message });
    }
  }

  async function remove(att: AttachmentDTO) {
    if (!confirm(`Remove "${att.fileName}"? Prior versions stay in the audit trail.`)) return;
    try {
      const res = await fetch(`${base}/${att.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readApiError(res, "Delete failed"));
      await refresh();
    } catch (e: any) {
      toast({ variant: "error", title: "Delete failed", description: e?.message });
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Paperclip size={15} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400">{items.length}</span>
      </div>

      {canManage && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 1 && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-select h-8 text-xs"
                aria-label="Attachment category"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
            {showDocumentCategory && (
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="form-select h-8 text-xs"
                aria-label="Document type"
              >
                <option value="">Document type…</option>
                {DOCUMENT_CATEGORIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
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
            className={cn(
              "rounded-lg border-2 border-dashed px-4 py-5 text-center transition",
              dragOver ? "border-primary-500 bg-primary-50/40" : "border-slate-300 bg-slate-50"
            )}
          >
            <Upload size={18} className="mx-auto mb-1.5 text-slate-400" />
            <p className="text-xs font-medium text-slate-700">Drag &amp; drop, or</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} /> Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={accept}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="mt-2 text-[11px] text-slate-500">
              {help ?? `PDF / image / DOCX / XLSX · up to ${MAX_SIZE / 1024 / 1024} MB`}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
          <Loader2 size={13} className="animate-spin" /> Loading…
        </div>
      ) : items.length === 0 && pending.length === 0 ? (
        <p className="py-2 text-xs text-slate-400">No documents attached yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {pending.map((p) => (
            <li
              key={p.tempId}
              className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs"
            >
              {p.status === "uploading" ? (
                <Loader2 size={13} className="animate-spin text-primary-600" />
              ) : (
                <AlertCircle size={13} className="text-rose-600" />
              )}
              <span className="truncate text-slate-700">{p.fileName}</span>
              {p.error && <span className="ml-auto text-rose-600">{p.error}</span>}
            </li>
          ))}
          {items.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2.5 py-2 text-xs"
            >
              {att.mimeType.startsWith("image/") ? (
                <ImageIcon size={14} className="shrink-0 text-slate-400" />
              ) : (
                <FileText size={14} className="shrink-0 text-slate-400" />
              )}
              <button
                type="button"
                onClick={() => download(att)}
                className="truncate text-left font-medium text-primary-700 hover:underline"
                title={att.fileName}
              >
                {att.fileName}
              </button>
              {att.documentCategory && (
                <span className="chip border-slate-200 bg-slate-50 text-[10px] text-slate-500">
                  {att.documentCategory}
                </span>
              )}
              {att.version > 1 && <span className="text-[10px] text-slate-400">v{att.version}</span>}
              <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                {(att.fileSize / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => download(att)}
                className="text-slate-400 hover:text-primary-700"
                aria-label="Download"
              >
                <Download size={13} />
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => remove(att)}
                  className="text-slate-400 hover:text-rose-600"
                  aria-label="Remove"
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
