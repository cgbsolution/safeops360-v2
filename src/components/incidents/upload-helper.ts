// Two-phase upload for Incident attachments. Mirrors the Near Miss and
// Observation helpers — same init / PUT / complete pattern against
// /api/incidents/{id}/attachments.
//
// Exists so the generic workflow ExecutionPanel can attach REAL CAPA-completion
// evidence on the incident's CAPA Execution step. Before this, INCIDENT was
// outside the panel's `supportsRealUpload` set, so a CAPA owner who attached
// before/after photos had only the filenames recorded in the audit trail — the
// files themselves were dropped on the floor and the incident's evidence
// gallery stayed empty on a fully closed investigation.

export type IncidentUploadCategory =
  | "INITIAL_PHOTO"
  | "WITNESS_STATEMENT"
  | "CCTV"
  | "EQUIPMENT_DATA"
  | "DOCUMENT"
  | "SKETCH"
  | "EXTERNAL_REPORT"
  | "CAPA_EVIDENCE"
  | "CLOSURE_DOC";

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

export async function uploadIncidentAttachment(
  incidentId: string,
  file: File,
  category: IncidentUploadCategory,
  caption?: string
): Promise<UploadResult> {
  try {
    const exif = await extractExif(file);

    const initRes = await fetch(`/api/incidents/${incidentId}/attachments`, {
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
    const initJson = await initRes.json().catch(() => ({}));
    if (!initRes.ok) {
      return { ok: false, error: initJson.error ?? initJson.detail ?? "Init failed", fileName: file.name };
    }

    const putRes = await fetch(initJson.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file
    });
    if (!putRes.ok) {
      return { ok: false, error: `Upload failed (${putRes.status})`, fileName: file.name };
    }

    const completeRes = await fetch(`/api/incidents/${incidentId}/attachments`, {
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
