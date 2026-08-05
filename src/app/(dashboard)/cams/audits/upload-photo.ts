// Real photo upload for audit checkpoints. Three steps (mirrors the
// incident/observation attachment flow):
//   1. POST /upload-url  → backend mints a signed Supabase upload URL
//   2. PUT the file bytes directly to that URL (service-role key never
//      touches the browser)
//   3. POST /view-url    → backend returns a signed download URL to display
// The returned { storagePath, url } is stored inline in the response's photos[].

export type AuditPhoto = {
  url: string;
  storagePath: string;
  caption?: string;
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

export type UploadResult =
  | { ok: true; photo: AuditPhoto }
  | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;

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
export async function viewAuditPhotoUrl(storagePath: string): Promise<string | null> {
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
export async function deleteAuditPhoto(storagePath?: string): Promise<void> {
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

export async function uploadAuditPhoto(
  file: File,
  opts: { auditId?: string; checkpointCode?: string; caption?: string },
): Promise<UploadResult> {
  if (file.size > MAX_BYTES) return { ok: false, error: `File is too large (max 10 MB).` };
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
    const viewRes = await postRetry("/api/audit-compliance/view-url", { storagePath: init.storagePath });
    if (!viewRes) return { ok: false, error: "Network error — photo saved but couldn't load preview." };
    if (!viewRes.ok) return { ok: false, error: await reason(viewRes, "Couldn't load uploaded photo") };
    const view = await viewRes.json();

    return { ok: true, photo: { url: view.url, storagePath: init.storagePath, caption: opts.caption ?? "" } };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
