// Parses an error Response from /api/* into a human-readable string.
//
// Why this exists: the Python backend (FastAPI) returns errors as
//   { "detail": "..." }       — for raise HTTPException
//   { "detail": [ { loc, msg, type }, ... ] }  — for 422 validation
// The legacy Node API returned errors as
//   { "error": "..." }
// Forms in this app were written for the Node shape, so when Python takes
// over they all show the literal string "Failed" and hide the real cause.
// This helper resolves both shapes plus the proxy's { reason } envelope so
// any caller can do: setError(await parseApiError(res)).

export async function parseApiError(res: Response, fallback = "Request failed"): Promise<string> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // Body wasn't JSON — try plain text.
    try {
      const t = await res.text();
      if (t) return `${res.status} — ${t.slice(0, 240)}`;
    } catch {}
    return `${fallback} (HTTP ${res.status})`;
  }
  let msg: string | undefined;
  if (typeof body.detail === "string") {
    msg = body.detail;
  } else if (Array.isArray(body.detail)) {
    msg = body.detail
      .map((d: any) => {
        const field = Array.isArray(d.loc) ? d.loc.slice(-1)[0] : "field";
        return `${field}: ${d.msg}`;
      })
      .join(" · ");
  } else if (typeof body.error === "string") {
    msg = body.error;
  } else if (typeof body.reason === "string") {
    msg = body.reason;
  } else if (typeof body.message === "string") {
    msg = body.message;
  }
  return msg ? `${res.status} — ${msg}` : `${fallback} (HTTP ${res.status})`;
}
