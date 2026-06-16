"use client";

// Disabled — auto-reload was masking real errors as "chunk drift" and
// triggering a refresh loop in dev mode. If a webpack chunk genuinely
// fails to load, the user can hard-refresh (Ctrl+Shift+R) themselves
// once. In production this almost never fires.
//
// Original behavior: catch chunk-load + HMR-drift errors via a global
// `window.error` listener, sessionStorage-capped retries, and a brief
// setTimeout reload. Kept the component shell so the app-shell layout
// doesn't need to change.

export function ChunkRecovery() {
  return null;
}
