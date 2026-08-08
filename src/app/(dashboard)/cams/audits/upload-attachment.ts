// Evidence upload for audit checkpoints — photographs AND documents. Three
// steps (mirrors the incident/observation attachment flow):
//   1. POST /upload-url  → backend mints a signed Supabase upload URL
//   2. PUT the file bytes directly to that URL (service-role key never
//      touches the browser)
//   3. POST /view-url    → backend returns a signed download URL to display
// The returned { storagePath, url, mimeType, fileName } is stored inline in the
// response's photos[] — that key predates document support and is left alone
// rather than migrated across every audit ever conducted.

export type AuditAttachment = {
  url: string;
  storagePath: string;
  caption?: string;
  /**
   * Recorded at upload so the render side never has to guess whether it may
   * point an `<img>` at this. Attachments predating document support carry no
   * type and are inferred from their extension — see `isImageAttachment`.
   */
  mimeType?: string;
  /** The auditor's own file name. A document's identity IS its name; a licence
   *  called "Factory_Licence_2026.pdf" is the evidence, a grey tile is not. */
  fileName?: string;
  /**
   * Set on an annotated photo: where the untouched capture lives. The marked
   * copy is what the checkpoint shows — ONE thumbnail per capture — but the
   * unmarked original stays retrievable, because flattening an arrow onto the
   * only copy of a photograph is irreversible and a certification body may ask
   * to see what the auditor actually photographed.
   */
  originalStoragePath?: string;
  originalUrl?: string;
};

/** Kept as the old name too: `photo` is what every existing caller destructures,
 *  and both fields are the same object. */
export type UploadResult =
  | { ok: true; attachment: AuditAttachment; photo: AuditAttachment }
  | { ok: false; error: string };

// A phone photo is a couple of MB; a scanned multi-page licence or a wage
// register export is routinely more. Documents therefore get the same 25 MB
// ceiling the rest of the product's evidence uploads use
// (`routers/attachments.py`), while photos keep the tighter one — a 20 MB
// "photo" is a mis-picked file, not evidence.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** Accept filters for the two pickers. Kept beside the size limits so the UI
 *  and the guard below cannot drift apart. */
export const IMAGE_ACCEPT = "image/*";
export const DOCUMENT_ACCEPT = [
  "application/pdf", ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx",
  "application/msword", ".doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx",
  "application/vnd.ms-excel", ".xls",
  "text/csv", ".csv",
  "text/plain", ".txt",
].join(",");

function fmtMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

// POST with one retry on a transient blip (network drop or 5xx from the pooler).
async function postRetry(url: string, body: unknown): Promise<Response | null> {
  const go = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  let r = await go();
  if (!r || r.status >= 500) {
    await new Promise((res) => setTimeout(res, 500));
    r = await go();
  }
  return r;
}

// Pull the clearest message out of a non-OK response (JSON {detail|error} or text).
async function reason(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.clone().json();
    if (j?.detail) return String(j.detail);
    if (j?.error) return String(j.error);
  } catch {
    /* not JSON */
  }
  const t = await res.text().catch(() => "");
  return t?.slice(0, 140) || `${fallback} (HTTP ${res.status})`;
}

/**
 * Signed view URL for an already-stored object.
 *
 * The iteration thread records evidence as bare `evidenceIds` (storage paths) —
 * no URL, because a signed URL expires and storing one on the interaction would
 * bake in a dead link. Anything rendering historical evidence therefore has to
 * re-sign at display time, which is what this does.
 *
 * Returns null rather than throwing: a missing photo should degrade to a broken
 * thumbnail placeholder, never take down the thread around it.
 */
export async function viewAuditAttachmentUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  try {
    const res = await postRetry("/api/audit-compliance/view-url", { storagePath });
    if (!res || !res.ok) return null;
    const j = await res.json();
    return j?.url ?? null;
  } catch {
    return null;
  }
}

// Best-effort: remove the object from Supabase when a photo is removed/replaced.
export async function deleteAuditAttachment(storagePath?: string): Promise<void> {
  if (!storagePath) return;
  try {
    await fetch("/api/audit-compliance/delete-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath }),
    });
  } catch {
    /* non-fatal — the record-level removal already happened */
  }
}

export async function uploadAuditAttachment(
  file: File,
  opts: { auditId?: string; checkpointCode?: string; caption?: string },
): Promise<UploadResult> {
  const isImage = file.type.startsWith("image/");
  const max = isImage ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size > max) {
    return {
      ok: false,
      error: `${isImage ? "Photo" : "Document"} is too large (${fmtMb(file.size)}) — the limit is ${fmtMb(max)}.`,
    };
  }
  try {
    // 1) signed upload URL
    const initRes = await postRetry("/api/audit-compliance/upload-url", { fileName: file.name, contentType: file.type, auditId: opts.auditId, checkpointCode: opts.checkpointCode });
    if (!initRes) return { ok: false, error: "Network error — couldn't start the upload." };
    if (!initRes.ok) return { ok: false, error: await reason(initRes, "Couldn't start upload") };
    const init = await initRes.json();

    // 2) PUT bytes straight to Supabase
    const put = await fetch(init.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    if (!put.ok) return { ok: false, error: await reason(put, "Upload to storage failed") };

    // 3) signed view URL for display
    const noun = isImage ? "Photo" : "Document";
    const viewRes = await postRetry("/api/audit-compliance/view-url", { storagePath: init.storagePath });
    if (!viewRes) return { ok: false, error: `Network error — ${noun.toLowerCase()} saved but couldn't load preview.` };
    if (!viewRes.ok) return { ok: false, error: await reason(viewRes, `Couldn't load uploaded ${noun.toLowerCase()}`) };
    const view = await viewRes.json();

    // `mimeType` and `fileName` are recorded so nothing downstream has to infer
    // what this is from its extension. The inference still exists for the
    // attachments stored before they did.
    const attachment: AuditAttachment = {
      url: view.url,
      storagePath: init.storagePath,
      caption: opts.caption ?? "",
      mimeType: file.type || undefined,
      fileName: file.name || undefined,
    };
    return { ok: true, attachment, photo: attachment };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

// Previous names, kept as aliases. Nothing in the tree uses them any more, but
// they are the API a caller written against the photo-only flow would reach
// for, and all three functions are type-agnostic — a signed URL and a storage
// delete never cared whether the object was a JPEG or a PDF.
export const uploadAuditPhoto = uploadAuditAttachment;
export const viewAuditPhotoUrl = viewAuditAttachmentUrl;
export const deleteAuditPhoto = deleteAuditAttachment;
