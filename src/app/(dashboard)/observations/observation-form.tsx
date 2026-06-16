"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/client-errors";
import { uploadObservationAttachment } from "@/components/observations/upload-helper";
import { Camera, Upload, X, Image as ImageIcon, Film, FileText, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Plant = { id: string; name: string; areas: { id: string; name: string }[] };

const TYPES = [
  { value: "SAFE_ACT", label: "Safe Act" },
  { value: "UNSAFE_ACT", label: "Unsafe Act" },
  { value: "SAFE_CONDITION", label: "Safe Condition" },
  { value: "UNSAFE_CONDITION", label: "Unsafe Condition" }
];

const CATEGORIES = [
  "PPE", "HOUSEKEEPING", "WORK_AT_HEIGHT", "HOT_WORK", "MOBILE_EQUIPMENT",
  "ELECTRICAL", "MATERIAL_HANDLING", "CONFINED_SPACE", "CHEMICAL_HANDLING",
  "EMERGENCY_PREP", "OTHERS"
];

const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

type LocalPhoto = {
  tempId: string;
  file: File;
  previewUrl?: string;
  error?: string;
};

export function ObservationForm({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<"" | "creating" | "uploading">("");
  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [severity, setSeverity] = useState("MEDIUM");
  const [error, setError] = useState("");
  const [uploadFailures, setUploadFailures] = useState<{ id: string; fileName: string; error: string }[]>([]);
  const [createdObservationId, setCreatedObservationId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const selectedPlant = plants.find((p) => p.id === plantId);
  const today = new Date().toISOString().slice(0, 10);

  // Revoke object URLs when photos change/unmount
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPlantChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPlantId(e.target.value);
  }

  function addFiles(incoming: FileList | File[]) {
    setError("");
    const list = Array.from(incoming);
    if (photos.length + list.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} photos. Remove some before adding more.`);
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

  // Severity-aware photo guidance — High and Critical strongly warrant evidence
  const photosRecommended = severity === "HIGH" || severity === "CRITICAL";
  const validPhotos = photos.filter((p) => !p.error);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Soft warning for High/Critical without photos — don't hard-block, but
    // confirm so users don't accidentally submit critical reports with no
    // evidence. Hard-blocking is a Phase 2 policy decision.
    if (photosRecommended && validPhotos.length === 0) {
      const ok = confirm(
        `${severity} severity observations should include site photos. Submit anyway?`
      );
      if (!ok) return;
    }

    setSubmitting(true);
    setSubmitStage("creating");
    setUploadFailures([]);

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = Object.fromEntries(fd.entries());
    // responsiblePersonId is now assigned by the Section Head during review.

    try {
      // 1. Create the observation
      const res = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError(await readApiError(res, "Failed to create observation"));
        setSubmitting(false);
        setSubmitStage("");
        return;
      }
      const created = await res.json();

      // 2. Upload photos sequentially (preserves order, simpler error handling)
      const failures: { id: string; fileName: string; error: string }[] = [];
      if (validPhotos.length > 0) {
        setSubmitStage("uploading");
        for (const p of validPhotos) {
          const result = await uploadObservationAttachment(created.id, p.file, "INITIAL_PHOTO");
          if (!result.ok) failures.push({ id: p.tempId, fileName: p.file.name, error: result.error ?? "Upload failed" });
        }
      }

      // 3. If any photos failed, stop here and show the error inline so the
      //    user knows why and can decide. The observation itself is already
      //    saved — they can navigate to it via the "View record" button.
      if (failures.length > 0) {
        setUploadFailures(failures);
        setCreatedObservationId(created.id);
        setSubmitStage("");
        setSubmitting(false);
        return;
      }

      // 4. All good — redirect to detail page with the green success banner.
      router.push(`/observations/${created.id}?just-created=1`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Network error. Check your connection and retry.");
      setSubmitting(false);
      setSubmitStage("");
    }
  }

  function viewCreatedRecord() {
    if (createdObservationId) {
      router.push(`/observations/${createdObservationId}?just-created=1&photo-errors=${uploadFailures.length}`);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Date" name="date" required>
              <Input name="date" type="date" defaultValue={today} required />
            </Field>
            <Field label="Severity" name="severity" required>
              <Select
                name="severity"
                required
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Plant" name="plantId" required>
              <Select name="plantId" value={plantId} onChange={onPlantChange} required>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Area" name="areaId" required>
              <Select name="areaId" required>
                {selectedPlant?.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Observation Type" name="type" required>
              <Select name="type" required defaultValue="UNSAFE_ACT">
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Category" name="category" required>
              <Select name="category" required defaultValue="PPE">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Description" name="description" required>
            <Textarea name="description" required minLength={10} placeholder="Describe what was observed, where, and any context (10 chars min)..." rows={4} />
          </Field>

          <Field label="Immediate Action Taken" name="immediateAction">
            <Textarea name="immediateAction" placeholder="Action taken on the spot, if any..." rows={2} />
          </Field>

          {/* Photos & Evidence — collected locally, uploaded after the
              observation is created so they're linked to the new record. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Site Photos
                {photosRecommended && (
                  <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Recommended for {severity} severity
                  </span>
                )}
              </Label>
              <span className="text-[11px] text-slate-500">
                {photos.length}/{MAX_FILES}
              </span>
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
                "rounded-md border-2 border-dashed transition px-4 py-5 text-center",
                dragOver ? "border-primary-500 bg-primary-50/40" : "border-slate-300 bg-slate-50"
              )}
            >
              <Upload size={20} className="mx-auto text-slate-400 mb-1.5" />
              <p className="text-sm text-slate-700 font-medium">Drag &amp; drop photos here</p>
              <p className="text-xs text-slate-500 mt-1">
                Photos help reviewers act faster. Max {MAX_FILES} files, {Math.round(MAX_SIZE / 1024 / 1024)} MB each.
              </p>
              <div className="mt-2.5 flex items-center justify-center gap-2">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                {photos.map((p) => (
                  <PhotoTile key={p.tempId} photo={p} onRemove={() => removePhoto(p.tempId)} />
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Target Closure Date" name="targetDate">
              <Input name="targetDate" type="date" min={today} />
              <p className="text-xs text-slate-500 mt-1">
                The Section Head will assign the responsible person during review.
              </p>
            </Field>
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {uploadFailures.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-amber-900">
                    Observation saved, but {uploadFailures.length} photo{uploadFailures.length === 1 ? "" : "s"} failed to upload
                  </div>
                  <div className="text-xs text-amber-800 mt-0.5">
                    The observation itself is recorded and the workflow has started. You can attach photos
                    later from the record's detail page.
                  </div>
                </div>
              </div>
              <ul className="text-xs space-y-1 pl-6">
                {uploadFailures.map((f) => (
                  <li key={f.id} className="text-amber-900">
                    <strong>{f.fileName}</strong> — <span className="text-amber-800">{f.error}</span>
                  </li>
                ))}
              </ul>
              {uploadFailures.some((f) => f.error.toLowerCase().includes("storage")) && (
                <div className="text-[11px] text-amber-700 bg-amber-100 border border-amber-200 rounded px-2 py-1.5 ml-6">
                  <strong>Admin note:</strong> Supabase Storage isn't configured on the server. Set
                  <code className="font-mono mx-1 bg-white/70 px-1 rounded">SUPABASE_URL</code> and the
                  <code className="font-mono mx-1 bg-white/70 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>
                  (the <em>secret</em> key — NOT the publishable/anon key)
                  in <code className="font-mono bg-white/70 px-1 rounded">.env</code>, create a private bucket named
                  <code className="font-mono mx-1 bg-white/70 px-1 rounded">incident-attachments</code>
                  (or whatever <code className="font-mono bg-white/70 px-1 rounded">SUPABASE_INCIDENT_BUCKET</code> is set to), then restart the backend.
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" onClick={viewCreatedRecord}>
                  View record →
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting || uploadFailures.length > 0}>
              {submitStage === "creating" && <><Loader2 size={14} className="animate-spin" /> Saving observation…</>}
              {submitStage === "uploading" && <><Loader2 size={14} className="animate-spin" /> Uploading photos…</>}
              {!submitStage && "Submit Observation"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
              Cancel
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
          {isVideo ? <Film size={28} className="text-slate-400" /> :
           photo.file.type === "application/pdf" ? <FileText size={28} className="text-slate-400" /> :
           <ImageIcon size={28} className="text-slate-400" />}
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
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
        <div className="text-[10px] text-white truncate">{photo.file.name}</div>
        <div className="text-[10px] text-white/80">
          {photo.error ? <span className="text-rose-300">{photo.error}</span> : sizeLabel}
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, required, children }: { label: string; name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}{required && <span className="text-rose-600 ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}
