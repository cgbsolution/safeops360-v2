// Client-side helper to extract a meaningful error message from a fetch
// Response. Tries JSON `{error}` first, then text body, then status reason.
// This is what every form should call on `!res.ok` so users never see a
// generic "Failed to submit" because the server returned non-JSON.
export async function readApiError(res: Response, fallback = "Request failed"): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `${fallback} (HTTP ${res.status})`;
    try {
      const j = JSON.parse(text);
      if (j && typeof j === "object" && j.error) return String(j.error);
      return `${fallback} (HTTP ${res.status})`;
    } catch {
      // Non-JSON body. Truncate so we don't dump an HTML error page in the UI.
      const trimmed = text.replace(/<[^>]*>/g, "").trim().slice(0, 200);
      return trimmed || `${fallback} (HTTP ${res.status})`;
    }
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}
