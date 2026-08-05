"use client";

// PTW closed-loop field evidence block — reused by EVERY lifecycle action
// panel (approve / accept / suspend / resume / extend / work-completed /
// handback / cancel / isolation-verify). Captures:
//   • GPS fix (useGeolocation — same hook as the creation wizard)
//   • onsite photo(s) — camera input, uploaded via the two-phase
//     signed-URL flow to POST /api/ptw/{id}/attachments
//   • drawn signature (shared SignaturePad)
//   • optional declaration the actor confirms
//
// The per-action photo requirement mirrors the backend policy
// (app/services/ptw_evidence.py EVIDENCE_POLICY) — the server re-validates
// and 422s regardless, this just makes the button state honest.

import { useCallback, useMemo, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { GpsCaptureStatus } from "@/components/ui/gps-capture";
import { SignatureField } from "@/components/ui/signature-pad";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/client-errors";

export type PtwEvidence = {
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
  signatureImageBase64: string | null;
  photoAttachmentIds: string[];
  declarationText: string | null;
};

type UploadedPhoto = { id: string; fileName: string };

/** Two-phase upload of one photo to the permit's attachment store.
 *  Returns the PermitAttachment id to reference from the evidence payload. */
export async function uploadPermitPhoto(
  permitId: string,
  file: File,
  category = "ACTION_EVIDENCE_PHOTO",
): Promise<string> {
  const init = await fetch(`/api/ptw/${permitId}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "init",
      category,
      fileName: file.name || `photo-${Date.now()}.jpg`,
      fileSize: file.size,
      mimeType: file.type || "image/jpeg",
    }),
  });
  if (!init.ok) throw new Error(await readApiError(init, "Photo upload init failed"));
  const j = await init.json();

  const put = await fetch(j.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!put.ok) throw new Error(`Photo upload failed (${put.status})`);

  const done = await fetch(`/api/ptw/${permitId}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: "complete", attachmentId: j.attachmentId }),
  });
  if (!done.ok) throw new Error(await readApiError(done, "Photo upload finalise failed"));
  return j.attachmentId as string;
}

export function useEvidenceCapture() {
  const gps = useGeolocation();
  const [signature, setSignature] = useState<string | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  const evidence: PtwEvidence = useMemo(
    () => ({
      gpsLatitude: gps.coords?.lat ?? null,
      gpsLongitude: gps.coords?.lng ?? null,
      gpsAccuracyMeters: gps.coords?.accuracy ?? null,
      signatureImageBase64: signature,
      photoAttachmentIds: photos.map((p) => p.id),
      declarationText: null, // filled by the panel from its declaration prop
    }),
    [gps.coords, signature, photos],
  );

  return { gps, signature, setSignature, photos, setPhotos, declarationAgreed, setDeclarationAgreed, evidence };
}

export function EvidenceCapture({
  permitId,
  requirePhoto,
  declaration,
  compact,
  state,
}: {
  permitId: string;
  /** Mirrors the backend EVIDENCE_POLICY for the action being taken. */
  requirePhoto: boolean;
  /** Declaration text the actor confirms (rendered with a mandatory tick). */
  declaration?: string;
  compact?: boolean;
  state: ReturnType<typeof useEvidenceCapture>;
}) {
  const { gps, signature, setSignature, photos, setPhotos, declarationAgreed, setDeclarationAgreed } = state;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setUploadError("");
      try {
        for (const f of Array.from(files)) {
          const id = await uploadPermitPhoto(permitId, f);
          setPhotos((prev) => [...prev, { id, fileName: f.name || "photo.jpg" }]);
        }
      } catch (e: any) {
        setUploadError(e?.message ?? "Photo upload failed");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [permitId, setPhotos],
  );

  return (
    <div className={`rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3 ${compact ? "text-xs" : "text-sm"}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Field evidence (recorded on the permit's audit trail)
      </div>

      {/* GPS */}
      <GpsCaptureStatus status={gps.status} coords={gps.coords} error={gps.error} onRetry={gps.request} />

      {/* Photos */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-slate-600">
          Onsite photo {requirePhoto ? <span className="text-rose-600">*</span> : <span className="text-slate-400">(optional)</span>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            {uploading ? "Uploading…" : "Take photo"}
          </Button>
          {photos.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800"
            >
              <ImageIcon size={11} /> {p.fileName.slice(0, 24)}
              <button
                type="button"
                className="text-emerald-700 hover:text-rose-600"
                onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                aria-label="Remove photo"
              >
                <Trash2 size={11} />
              </button>
            </span>
          ))}
        </div>
        {uploadError && <div className="text-[11px] text-rose-700">{uploadError}</div>}
      </div>

      {/* Signature */}
      <SignatureField value={signature} onChange={setSignature} required />

      {/* Declaration */}
      {declaration && (
        <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs">
          <input
            type="checkbox"
            checked={declarationAgreed}
            onChange={(e) => setDeclarationAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-slate-700">{declaration}</span>
        </label>
      )}
    </div>
  );
}

/** True when the evidence block satisfies the given policy. */
export function evidenceComplete(
  state: ReturnType<typeof useEvidenceCapture>,
  opts: { requirePhoto: boolean; requireDeclaration: boolean },
): boolean {
  const hasGps = state.gps.coords != null;
  const hasSig = !!state.signature;
  const hasPhoto = !opts.requirePhoto || state.photos.length > 0;
  const declared = !opts.requireDeclaration || state.declarationAgreed;
  return hasGps && hasSig && hasPhoto && declared;
}

/** Builds the API payload's `evidence` object from the capture state. */
export function evidencePayload(
  state: ReturnType<typeof useEvidenceCapture>,
  declaration?: string,
): Record<string, unknown> {
  return {
    gpsLatitude: state.evidence.gpsLatitude,
    gpsLongitude: state.evidence.gpsLongitude,
    gpsAccuracyMeters: state.evidence.gpsAccuracyMeters,
    signatureImageBase64: state.evidence.signatureImageBase64,
    photoAttachmentIds: state.evidence.photoAttachmentIds.length > 0 ? state.evidence.photoAttachmentIds : null,
    declarationText: declaration && state.declarationAgreed ? declaration : null,
  };
}
