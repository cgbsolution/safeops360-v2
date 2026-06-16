"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Upload, X, Image as ImageIcon, FileText, Film, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Lightweight uploaded-attachment shape used by callers
export type UploadedAttachment = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caption?: string | null;
  exifData?: any;
};

type LocalFile = {
  // Client-side temp id for keying; replaced with the server attachmentId after init.
  tempId: string;
  attachmentId?: string;
  file: File;
  caption: string;
  // Object URL for thumbnail preview (revoked on unmount / removal)
  previewUrl?: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  errorMessage?: string;
  exifData?: any;
};

const MAX_FILES = 10;
const MAX_SIZE = 50 * 1024 * 1024;

// Reusable two-phase upload component:
//   1) ask server for signed URL  (POST /api/incidents/{id}/attachments phase=init)
//   2) browser PUTs binary directly to Supabase
//   3) ask server to finalise metadata (caption, exif)  (phase=complete)
//
// Drag-drop, mobile camera capture, multi-file selection, captions, EXIF
// extraction (client-side via exifr), per-file progress + remove.
export function MultiFileUpload({
  incidentId,
  category,
  capaRef,
  witnessRef,
  accept = "image/*",
  buttonLabel = "Upload Files",
  helpText,
  onUploaded
}: {
  incidentId: string;
  category: string;
  capaRef?: string;
  witnessRef?: string;
  accept?: string;
  buttonLabel?: string;
  helpText?: string;
  onUploaded?: (attachment: UploadedAttachment) => void;
}) {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    setError(null);
    const list = Array.from(incoming);
    if (files.length + list.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files at once.`);
      return;
    }

    const accepted: LocalFile[] = [];
    for (const f of list) {
      if (f.size > MAX_SIZE) {
        accepted.push({
          tempId: crypto.randomUUID(),
          file: f,
          caption: "",
          status: "error",
          errorMessage: `Exceeds ${Math.round(MAX_SIZE / 1024 / 1024)} MB`
        });
        continue;
      }
      const previewUrl = f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
      accepted.push({
        tempId: crypto.randomUUID(),
        file: f,
        caption: "",
        previewUrl,
        status: "pending"
      });
    }
    setFiles((prev) => [...prev, ...accepted]);
    // Kick off uploads asynchronously
    accepted.forEach((af) => {
      if (af.status === "pending") void uploadOne(af);
    });
  }, [files.length]);

  async function extractExif(file: File): Promise<any | null> {
    if (!file.type.startsWith("image/")) return null;
    try {
      // Lazy-import so non-photo flows don't pay the cost
      const exifr = (await import("exifr")).default;
      const data = await exifr.parse(file, { gps: true });
      if (!data) return null;
      return {
        gps: data.latitude && data.longitude ? { lat: data.latitude, lng: data.longitude } : undefined,
        takenAt: data.DateTimeOriginal ? new Date(data.DateTimeOriginal).toISOString() : undefined,
        make: data.Make,
        model: data.Model
      };
    } catch {
      return null;
    }
  }

  async function uploadOne(local: LocalFile) {
    setFiles((prev) => prev.map((f) => (f.tempId === local.tempId ? { ...f, status: "uploading" } : f)));
    try {
      const exif = await extractExif(local.file);

      // Phase 1 — signed URL
      const initRes = await fetch(`/api/incidents/${incidentId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "init",
          category,
          capaRef,
          witnessRef,
          fileName: local.file.name,
          fileSize: local.file.size,
          mimeType: local.file.type
        })
      });
      const initJson = await initRes.json();
      if (!initRes.ok) throw new Error(initJson.error ?? "Init failed");

      // Phase 2 — direct PUT to Supabase
      const putRes = await fetch(initJson.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": local.file.type },
        body: local.file
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      // Phase 3 — finalise metadata (caption may be added later, set what we have)
      const completeRes = await fetch(`/api/incidents/${incidentId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "complete",
          attachmentId: initJson.attachmentId,
          exifData: exif ?? undefined
        })
      });
      const completeJson = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeJson.error ?? "Finalise failed");

      setFiles((prev) =>
        prev.map((f) =>
          f.tempId === local.tempId ? { ...f, status: "uploaded", attachmentId: initJson.attachmentId, exifData: exif } : f
        )
      );

      onUploaded?.({
        id: initJson.attachmentId,
        fileName: local.file.name,
        fileSize: local.file.size,
        mimeType: local.file.type,
        exifData: exif
      });
    } catch (e: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.tempId === local.tempId ? { ...f, status: "error", errorMessage: e?.message ?? "Upload failed" } : f
        )
      );
    }
  }

  async function saveCaption(local: LocalFile, caption: string) {
    setFiles((prev) => prev.map((f) => (f.tempId === local.tempId ? { ...f, caption } : f)));
    if (!local.attachmentId) return;
    try {
      await fetch(`/api/incidents/${incidentId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "complete",
          attachmentId: local.attachmentId,
          caption
        })
      });
    } catch {
      /* swallow — caption is non-critical and will be retried on blur */
    }
  }

  async function removeOne(local: LocalFile) {
    if (local.previewUrl) URL.revokeObjectURL(local.previewUrl);
    setFiles((prev) => prev.filter((f) => f.tempId !== local.tempId));
    if (local.attachmentId) {
      try {
        await fetch(`/api/incidents/${incidentId}/attachments/${local.attachmentId}`, {
          method: "DELETE"
        });
      } catch {
        /* server-side delete failure isn't fatal — UI already removed */
      }
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-md border-2 border-dashed transition px-4 py-6 text-center",
          dragOver ? "border-primary-500 bg-primary-50/40" : "border-slate-300 bg-slate-50"
        )}
      >
        <Upload size={22} className="mx-auto text-slate-400 mb-2" />
        <p className="text-sm text-slate-700 font-medium">Drag &amp; drop files here</p>
        {helpText && <p className="text-xs text-slate-500 mt-1">{helpText}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} /> {buttonLabel}
          </Button>
          {accept.startsWith("image") && (
            <Button type="button" size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
              <Camera size={13} /> Take Photo
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ capture: "environment" } as any)}
          className="hidden"
          onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
        />
        <p className="text-[11px] text-slate-500 mt-2">
          Up to {MAX_FILES} files · {Math.round(MAX_SIZE / 1024 / 1024)} MB each · JPG / PNG / HEIC / MP4 / PDF / DOCX / XLSX / CSV
        </p>
      </div>

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => <FileRow key={f.tempId} file={f} onCaptionBlur={(cap) => saveCaption(f, cap)} onRemove={() => removeOne(f)} />)}
        </div>
      )}
    </div>
  );
}

function FileRow({
  file,
  onCaptionBlur,
  onRemove
}: {
  file: LocalFile;
  onCaptionBlur: (caption: string) => void;
  onRemove: () => void;
}) {
  const [caption, setCaption] = useState(file.caption);
  const isImage = file.file.type.startsWith("image/");
  const isVideo = file.file.type.startsWith("video/");
  const sizeKb = Math.round(file.file.size / 1024);
  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

  return (
    <div className="flex items-start gap-3 rounded-md border bg-white p-2.5">
      <div className="w-14 h-14 rounded bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {isImage && file.previewUrl ? (
          <img src={file.previewUrl} alt="" className="w-full h-full object-cover" />
        ) : isVideo ? (
          <Film size={22} className="text-slate-400" />
        ) : file.file.type === "application/pdf" || file.file.type.startsWith("application/") ? (
          <FileText size={22} className="text-slate-400" />
        ) : (
          <ImageIcon size={22} className="text-slate-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-900 truncate">{file.file.name}</span>
          <span className="text-[11px] text-slate-500 flex-shrink-0">{sizeLabel}</span>
        </div>

        {file.status === "uploading" && (
          <div className="mt-1 text-xs text-primary-700 flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> Uploading…
          </div>
        )}
        {file.status === "uploaded" && (
          <div className="mt-1">
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={() => onCaptionBlur(caption)}
              placeholder="Caption (optional)"
              className="h-7 text-xs"
            />
            {file.exifData?.gps && (
              <div className="text-[11px] text-slate-500 mt-1">
                📍 {file.exifData.gps.lat.toFixed(5)}, {file.exifData.gps.lng.toFixed(5)}
                {file.exifData.takenAt && <> · {new Date(file.exifData.takenAt).toLocaleString("en-IN")}</>}
              </div>
            )}
          </div>
        )}
        {file.status === "error" && (
          <div className="mt-1 text-xs text-rose-700 flex items-center gap-1">
            <AlertCircle size={11} /> {file.errorMessage ?? "Upload failed"}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="text-slate-400 hover:text-rose-600 flex-shrink-0"
        aria-label="Remove"
      >
        <X size={14} />
      </button>
    </div>
  );
}
