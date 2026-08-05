"use client";

// Registers the capture service worker (scope /capture — the rest of the app
// is untouched) and starts the outbox sync engine. Mounted once from the
// (field) layout. Both are feature-detected no-ops on unsupported browsers.

import { useEffect } from "react";
import { startSyncEngine } from "@/lib/capture/sync";

export function SwRegistrar() {
  useEffect(() => {
    startSyncEngine();
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/capture" })
        .catch(() => undefined); // offline mode unavailable — online flow still works
      return;
    }

    // DEV: never let the service worker cache the app — it serves a stale shell
    // and masks every code change (the #1 "why doesn't it update?" trap). Also
    // proactively unregister any SW installed by a previous dev session and drop
    // its caches, so the very next reload shows fresh code.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => void r.unregister()))
      .catch(() => undefined);
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => keys.forEach((k) => k.startsWith("capture") && caches.delete(k)))
        .catch(() => undefined);
    }
  }, []);
  return null;
}
