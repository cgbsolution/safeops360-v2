"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Send, AlertCircle, Upload, X, Image as ImageIcon, Film, Loader2, Sparkles } from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";
import { uploadObservationAttachment } from "@/components/observations/upload-helper";
import { uploadNearMissAttachment } from "@/components/near-miss/upload-helper";
import { uploadIncidentAttachment } from "@/components/incidents/upload-helper";

type Task = {
  id: string;
  stepName: string;
  taskType: string;
  dueAt?: Date | string | null;
};

type LocalPhoto = {
  tempId: string;
  file: File;
  previewUrl?: string;
  error?: string;
};

const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024;

// Generic execution panel — modules pass module-specific instruction text + extra fields.
// For OBSERVATION, we additionally do real Supabase uploads tagged
// ACTION_EVIDENCE so the photos show up in the record's gallery + survive
// page reloads. Other modules still get filename-only capture until they're
// upgraded to the same attachment infrastructure.
export function ExecutionPanel({
  task,
  module,
  recordId,
  instruction,
  extraFields,
  evidenceLabel = "Evidence Photos (proof of corrective action)",
  reworkContext,
  aiDraftPath
}: {
  task: Task;
  module: string;
  /** The underlying record id (e.g., observation id). Required for real uploads. */
  recordId?: string;
  instruction: string;
  extraFields?: { name: string; label: string; type?: string; required?: boolean }[];
  evidenceLabel?: string;
  /** Set when this is a rework execution (the verifier rejected an earlier
      execution). Surfaces the rejection reason at the top so the action
      owner sees what to fix before re-submitting. */
  reworkContext?: {
    rejectedBy: string | null;
    rejectedAt: Date | string | null;
    reason: string | null;
  } | null;
  /** When set, shows a "Draft with AI" button that POSTs to this path and
      fills the Action Narrative from a model-generated draft. The endpoint
      must return { ok, narrative, evidenceDescription?, reason? }. The user
      always reviews/edits the draft before submitting. */
  aiDraftPath?: string;
}) {
  const router = useRouter();
  const [narrative, setNarrative] = useState("");
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"" | "uploading" | "submitting">("");
  const [error, setError] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  // AI-draft state
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiDrafted, setAiDrafted] = useState(false);
  const [aiEvidenceHint, setAiEvidenceHint] = useState("");

  async function draftWithAi() {
    if (!aiDraftPath) return;
    setAiBusy(true);
    setAiError("");
    try {
      const res = await fetch(aiDraftPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Pass whatever the user already typed so the model builds on it.
        body: JSON.stringify({ hint: narrative })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok && j.narrative) {
        setNarrative(j.narrative);
        setAiDrafted(true);
        setAiEvidenceHint(j.evidenceDescription ?? "");
      } else {
        setAiError(j.reason ?? j.error ?? j.detail ?? "Could not generate a draft. Please write it manually.");
      }
    } catch {
      setAiError("Network error while drafting. Please write it manually.");
    } finally {
      setAiBusy(false);
    }
  }

  // Modules wired to two-phase Supabase uploads. NEAR_MISS execution evidence
  // lands in the record's "Photos & Evidence" gallery under CAPA evidence; was
  // previously filename-only here, so evidence attached on the execution panel
  // never actually uploaded or showed up.
  const supportsRealUpload =
    (module === "OBSERVATION" || module === "NEAR_MISS" || module === "INCIDENT") && !!recordId;

  async function uploadEvidence(file: File) {
    if (module === "NEAR_MISS") return uploadNearMissAttachment(recordId!, file, "CAPA_EVIDENCE");
    if (module === "INCIDENT") return uploadIncidentAttachment(recordId!, file, "CAPA_EVIDENCE");
    return uploadObservationAttachment(recordId!, file, "ACTION_EVIDENCE");
  }

  // Revoke object URLs on unmount to avoid leaking blob memory
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(incoming: FileList | File[]) {
    setError("");
    const list = Array.from(incoming);
    if (photos.length + list.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} photos.`);
      return;
    }
    const accepted: LocalPhoto[] = [];
    for (const f of list) {
      if (f.size > MAX_SIZE) {
        accepted.push({
          tempId: crypto.randomUUID(),
          file: f,
          error: `Exceeds ${Math.round(MAX_SIZE / 1024 / 1024)} MB`
        });
        continue;
      }
      const previewUrl = f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
      accepted.push({ tempId: crypto.randomUUID(), file: f, previewUrl });
    }
    setPhotos((prev) => [...prev, ...accepted]);
  }

  function removePhoto(tempId: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.tempId === tempId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.tempId !== tempId);
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!narrative.trim()) {
      setError("Action narrative is required");
      return;
    }
    setBusy(true);
    setError("");

    const validPhotos = photos.filter((p) => !p.error);
    const attachmentNames: string[] = [];

    try {
      // Phase 1 — upload photos as evidence (OBSERVATION → ACTION_EVIDENCE,
      // NEAR_MISS → CAPA_EVIDENCE). Each one becomes visible in the record's
      // "Photos & Evidence" gallery.
      if (supportsRealUpload && validPhotos.length > 0 && recordId) {
        setStage("uploading");
        for (const p of validPhotos) {
          const result = await uploadEvidence(p.file);
          if (!result.ok) {
            setError(`Upload failed for "${p.file.name}": ${result.error}`);
            setBusy(false);
            setStage("");
            return;
          }
          attachmentNames.push(p.file.name);
        }
      } else if (!supportsRealUpload && validPhotos.length > 0) {
        // Fallback for modules that haven't been upgraded — record filenames
        // only so the audit trail at least references them.
        attachmentNames.push(...validPhotos.map((p) => p.file.name));
      }

      // Phase 2 — submit the workflow task to advance to verification
      setStage("submitting");
      const res = await fetch("/api/workflow/submit-execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          comments: narrative,
          attachments: attachmentNames,
          executionData: extras
        })
      });
      if (res.ok) {
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? j.detail ?? `Submit failed (${res.status})`);
      }
    } catch (err: any) {
      setError(err?.message ?? "Network error. Check your connection and retry.");
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <Card className="border-amber-300 ring-2 ring-amber-100">
      <CardHeader className="bg-amber-50 rounded-t-xl">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-amber-900 flex items-center gap-2">
              <AlertCircle size={18} /> Task Assigned to You
            </CardTitle>
            <CardDescription className="text-amber-700">{task.stepName}</CardDescription>
          </div>
          {task.dueAt && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-amber-600">Due</div>
              <div className="text-xs text-amber-900 font-medium">{formatDateTime(task.dueAt)}</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {reworkContext && (
          <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2 text-rose-900 font-semibold mb-1">
              <AlertCircle size={14} /> Rework requested by verifier
            </div>
            {reworkContext.reason && (
              <div className="text-rose-800 italic mb-1">"{reworkContext.reason}"</div>
            )}
            <div className="text-[11px] text-rose-700">
              {reworkContext.rejectedBy ? <>By <strong>{reworkContext.rejectedBy}</strong></> : null}
              {reworkContext.rejectedBy && reworkContext.rejectedAt ? " · " : ""}
              {reworkContext.rejectedAt ? formatDateTime(reworkContext.rejectedAt) : null}
            </div>
          </div>
        )}
        <p className="text-sm text-slate-700 mb-3">{instruction}</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Action Narrative / Remark<span className="text-rose-600">*</span></Label>
              {aiDraftPath && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={draftWithAi}
                  disabled={aiBusy || busy}
                  className="border-violet-300 text-violet-700 hover:bg-violet-50"
                >
                  {aiBusy ? (
                    <><Loader2 size={13} className="animate-spin" /> Drafting…</>
                  ) : (
                    <><Sparkles size={13} /> {narrative.trim() ? "Improve with AI" : "Draft with AI"}</>
                  )}
                </Button>
              )}
            </div>
            <Textarea
              rows={4}
              required
              placeholder="Describe what corrective action you took, the result observed, and any follow-up needed..."
              value={narrative}
              onChange={(e) => { setNarrative(e.target.value); setAiDrafted(false); }}
            />
            {aiDrafted && (
              <p className="text-[11px] text-violet-700 flex items-center gap-1">
                <Sparkles size={11} /> AI-drafted from the near-miss details — please review and edit before submitting.
              </p>
            )}
            {aiEvidenceHint && (
              <p className="text-[11px] text-slate-500">
                <span className="font-medium text-slate-600">Suggested evidence:</span> {aiEvidenceHint}
              </p>
            )}
            {aiError && (
              <p className="text-[11px] text-amber-700 flex items-center gap-1">
                <AlertCircle size={11} /> {aiError}
              </p>
            )}
          </div>

          {extraFields?.map((f) => (
            <div key={f.name} className="space-y-2">
              <Label>{f.label}{f.required && <span className="text-rose-600">*</span>}</Label>
              <Input
                type={f.type ?? "text"}
                required={f.required}
                value={extras[f.name] ?? ""}
                onChange={(e) => setExtras({ ...extras, [f.name]: e.target.value })}
              />
            </div>
          ))}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{evidenceLabel}</Label>
              <span className="text-[11px] text-slate-500">{photos.length}/{MAX_FILES}</span>
            </div>

            <div
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "rounded-md border-2 border-dashed transition px-4 py-4 text-center",
                dragOver ? "border-primary-500 bg-primary-50/40" : "border-slate-300 bg-slate-50"
              )}
            >
              <Upload size={18} className="mx-auto text-slate-400 mb-1" />
              <p className="text-sm text-slate-700 font-medium">Drag &amp; drop evidence photos here</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {supportsRealUpload
                  ? `Up to ${MAX_FILES} files · ${Math.round(MAX_SIZE / 1024 / 1024)} MB each`
                  : `Filename only — full upload will be enabled for this module soon`}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={13} /> Browse
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                  <Camera size={13} /> Take Photo
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ capture: "environment" } as any)}
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {photos.map((p) => (
                  <PhotoTile key={p.tempId} photo={p} onRemove={() => removePhoto(p.tempId)} />
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={busy} variant="success">
              {stage === "uploading" && <><Loader2 size={14} className="animate-spin" /> Uploading evidence…</>}
              {stage === "submitting" && <><Loader2 size={14} className="animate-spin" /> Submitting…</>}
              {!stage && <><Send size={16} /> Submit Completed Task</>}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PhotoTile({ photo, onRemove }: { photo: LocalPhoto; onRemove: () => void }) {
  const isImage = photo.file.type.startsWith("image/");
  const isVideo = photo.file.type.startsWith("video/");
  const sizeKb = Math.round(photo.file.size / 1024);
  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

  return (
    <div className="group relative aspect-square rounded-md border bg-slate-100 overflow-hidden">
      {isImage && photo.previewUrl ? (
        <img src={photo.previewUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {isVideo ? <Film size={26} className="text-slate-400" /> : <ImageIcon size={26} className="text-slate-400" />}
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 bg-white/90 hover:bg-white rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition"
        aria-label="Remove"
      >
        <X size={12} />
      </button>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1">
        <div className="text-[10px] text-white truncate">{photo.file.name}</div>
        <div className="text-[10px] text-white/80">
          {photo.error ? <span className="text-rose-300">{photo.error}</span> : sizeLabel}
        </div>
      </div>
    </div>
  );
}

// Verification panel — same shape as approval, but action labels are different
export function VerificationPanel({ task }: { task: Task }) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(accepted: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/workflow/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, accepted, comments })
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      const e = await res.json().catch(() => ({}));
      setError(e.error ?? e.detail ?? `Action failed (${res.status})`);
    }
  }

  return (
    <Card className="border-blue-300 ring-2 ring-blue-100">
      <CardHeader className="bg-blue-50 rounded-t-xl">
        <CardTitle className="text-blue-900">🔍 Verification Required</CardTitle>
        <CardDescription className="text-blue-700">{task.stepName}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm text-slate-700">
          Review the executed action and the evidence provided. Confirm the action is genuine and effective, or send back for rework.
        </p>
        <div className="space-y-2">
          <Label>Verification Comments</Label>
          <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Findings, effectiveness check, anything to note..." />
        </div>
        {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</div>}
        <div className="flex gap-2">
          <Button onClick={() => decide(true)} disabled={busy} variant="success">Accept & Advance</Button>
          <Button onClick={() => decide(false)} disabled={busy} variant="destructive">Send Back for Rework</Button>
        </div>
      </CardContent>
    </Card>
  );
}
