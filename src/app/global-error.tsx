"use client";

// Last-resort error boundary at the app root. Most errors should be caught
// by the per-segment error.tsx (e.g. (dashboard)/error.tsx) — this only
// fires when something blows up so early in the render that the segment
// boundary can't catch it (e.g. a layout-level chunk failure).
//
// Same auto-recovery contract as the segment error boundary: silently
// reload the page on transient webpack chunk-load errors, capped at 2
// retries per URL via sessionStorage.

import { useEffect } from "react";

function isChunkLoadError(error: Error & { digest?: string }): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  const stack = (error?.stack ?? "").toLowerCase();
  return (
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("chunkloaderror") ||
    msg.includes("dynamically imported module") ||
    (msg.includes("cannot read properties of undefined") &&
      msg.includes("'call'")) ||
    stack.includes("options.factory") ||
    stack.includes("__webpack_require__") ||
    stack.includes("requireModule")
  );
}

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global error]", error);
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      const KEY = "safeops_chunk_reload_count";
      const url = window.location.pathname + window.location.search;
      let map: Record<string, number> = {};
      try {
        map = JSON.parse(sessionStorage.getItem(KEY) || "{}");
      } catch {
        map = {};
      }
      const count = (map[url] ?? 0) + 1;
      if (count <= 2) {
        sessionStorage.setItem(
          KEY,
          JSON.stringify({ ...map, [url]: count })
        );
        setTimeout(() => window.location.reload(), 300);
      }
    }
  }, [error]);

  return (
    <html>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "4rem 2rem",
          textAlign: "center",
          color: "#334155"
        }}
      >
        <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Reloading…</h2>
        <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: 8 }}>
          The page hit a temporary loading error. Auto-recovery in progress.
        </p>
        <button
          onClick={() => {
            try {
              sessionStorage.removeItem("safeops_chunk_reload_count");
            } catch {}
            window.location.reload();
          }}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "white",
            cursor: "pointer"
          }}
        >
          Refresh now
        </button>
      </body>
    </html>
  );
}
