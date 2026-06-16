"use client";

// Dashboard error boundary. Three failure shapes we handle:
//
// 1. Webpack chunk-load / "module factory undefined" errors — these are
//    Next.js dev-server HMR drift bugs (especially on 14.1.x) where the
//    browser holds a reference to a chunk the server already replaced.
//    These auto-recover on full reload, so we silently reload after a
//    short delay instead of dumping a scary red error to the user. This
//    is the single biggest UX fix — it stops the "I have to hard-refresh
//    every page" pain.
// 2. Transient Supabase pool exhaustion. Showed up because the old
//    connection_limit=1 was strangling parallel queries; now mitigated
//    by the prisma.ts pool fix, but the recovery copy stays for safety.
// 3. Genuine code/data errors — show the digest + manual refresh button.
//
// In production builds Next.js HIDES `error.message` (security — to avoid
// leaking sensitive info). Only `error.digest` is available client-side.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Returns true if the error looks like a transient webpack/HMR chunk-load
// failure — these always recover on a full page reload, so we should
// auto-recover instead of asking the user to click anything.
function isChunkLoadError(error: Error & { digest?: string }): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  const stack = (error?.stack ?? "").toLowerCase();
  return (
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("chunkloaderror") ||
    msg.includes("dynamically imported module") ||
    // The signature of the Next.js 14.1.x HMR-drift bug:
    //   "Cannot read properties of undefined (reading 'call')"
    //   ...with options.factory / __webpack_require__ in the stack
    (msg.includes("cannot read properties of undefined") &&
      msg.includes("'call'")) ||
    stack.includes("options.factory") ||
    stack.includes("__webpack_require__") ||
    stack.includes("requireModule")
  );
}

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const chunkBug = isChunkLoadError(error);

  useEffect(() => {
    // Always log so engineers can see the real cause in dev.
    console.error("[dashboard error]", error);

    // Auto-recover from chunk-load errors. We track recovery attempts in
    // sessionStorage so a genuinely broken chunk doesn't trap the user
    // in an infinite reload loop — after 2 silent retries we surface the
    // manual UI.
    if (chunkBug && typeof window !== "undefined") {
      const KEY = "safeops_chunk_reload_count";
      const url = window.location.pathname + window.location.search;
      const stored = (() => {
        try {
          return JSON.parse(sessionStorage.getItem(KEY) || "{}");
        } catch {
          return {};
        }
      })();
      const count = (stored[url] ?? 0) + 1;
      if (count <= 2) {
        sessionStorage.setItem(KEY, JSON.stringify({ ...stored, [url]: count }));
        // Small delay to let the dev server finish writing the chunk;
        // also gives webpack a moment to update its manifest.
        setTimeout(() => window.location.reload(), 300);
      } else {
        // After two retries, clear and stop auto-reloading so the user
        // can see the actual error (it's no longer a transient HMR
        // glitch — something is genuinely broken).
        sessionStorage.removeItem(KEY);
      }
    } else if (typeof window !== "undefined") {
      // Non-chunk error — clear any retry counter so a future chunk
      // error gets its full retry budget.
      sessionStorage.removeItem("safeops_chunk_reload_count");
    }
  }, [error, chunkBug]);

  // Best-effort classification. In dev `message` is populated and we
  // recognise the Supabase pool error; in prod we fall back to a
  // generic "temporary problem" copy that's still actionable.
  const msg = (error?.message ?? "").toLowerCase();
  const isPoolExhausted =
    msg.includes("max clients") ||
    msg.includes("emaxconn") ||
    msg.includes("too many connections");
  const isReachable =
    !msg.includes("can't reach database") &&
    !msg.includes("econnrefused");

  const headline = chunkBug
    ? "Reloading…"
    : isPoolExhausted
      ? "Server is briefly busy"
      : isReachable
        ? "This page didn't load"
        : "Cannot reach the server";

  const detail = chunkBug
    ? "The dev server sent a stale module reference. Auto-reloading — this should clear in a second."
    : isPoolExhausted
      ? "Too many requests hit the database at once. A refresh almost always fixes this — the next attempt gets a fresh connection."
      : isReachable
        ? "A temporary problem stopped this page from rendering. Refreshing usually clears it. If it keeps happening, share the digest below with support."
        : "We can't connect to the backend right now. Please check your network or try again in a moment.";

  // Force a real navigation refresh — not the React error boundary's
  // soft reset. This is what actually re-runs the SSR fetch (and on
  // Vercel typically lands on a fresh Lambda + fresh DB connection).
  function hardRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 p-8">
      <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center">
        <AlertTriangle className="text-rose-600" size={28} />
      </div>
      <h2 className="text-xl font-semibold text-slate-800">{headline}</h2>
      <p className="text-slate-500 max-w-sm text-sm">{detail}</p>

      <div className="flex items-center gap-2">
        <Button onClick={hardRefresh} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh page"}
        </Button>
        <Button onClick={reset} variant="outline" size="sm" disabled={refreshing}>
          Retry without refresh
        </Button>
      </div>

      {error?.digest && (
        <p className="text-[11px] text-slate-400 font-mono pt-2">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
