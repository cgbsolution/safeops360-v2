// Shared upload helper used by the new-observation form (deferred upload after
// the observation is created) and the post-creation gallery.
//
// Two-phase upload pattern — see /api/observations/[id]/attachments/route.ts:
//   1. POST { phase: "init" } → server creates DB row, returns signed URL
//   2. PUT binary directly to Supabase
//   3. POST { phase: "complete" } → server records EXIF/caption metadata

export type UploadCategory =
  | "INITIAL_PHOTO"
  | "ACTION_EVIDENCE"
  | "VERIFICATION_PHOTO"
  | "DOCUMENT";

export type UploadResult = {
  ok: boolean;
  attachmentId?: string;
  error?: string;
  fileName: string;
};

async function extractExif(file: File): Promise<any | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
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

export async function uploadObservationAttachment(
  observationId: string,
  file: File,
  category: UploadCategory,
  caption?: string
): Promise<UploadResult> {
  try {
    const exif = await extractExif(file);

    const initRes = await fetch(`/api/observations/${observationId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: "init",
        category,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      })
    });
    const initJson = await initRes.json();
    if (!initRes.ok) {
      // FastAPI returns errors as {detail}; legacy Node returned {error}.
      const message = initJson.error ?? initJson.detail ?? "Init failed";
      return { ok: false, error: message, fileName: file.name };
    }

    const putRes = await fetch(initJson.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file
    });
    if (!putRes.ok) {
      return { ok: false, error: `Upload failed (${putRes.status})`, fileName: file.name };
    }

    const completeRes = await fetch(`/api/observations/${observationId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: "complete",
        attachmentId: initJson.attachmentId,
        exifData: exif ?? undefined,
        caption: caption ?? undefined
      })
    });
    if (!completeRes.ok) {
      const j = await completeRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? j.detail ?? "Finalise failed", fileName: file.name };
    }

    return { ok: true, attachmentId: initJson.attachmentId, fileName: file.name };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error", fileName: file.name };
  }
}
