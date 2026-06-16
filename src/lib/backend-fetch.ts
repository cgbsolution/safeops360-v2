// ════════════════════════════════════════════════════════════════════════
//  Backend fetch with optional TLS bypass.
// ════════════════════════════════════════════════════════════════════════
//
//  ⚠️  TEMPORARY ESCAPE HATCH — DO NOT KEEP IN PRODUCTION  ⚠️
//
//  When the Python backend is hosted behind a self-signed or otherwise
//  invalid TLS certificate (a known limitation while you're getting
//  Let's Encrypt working on Dokploy), Vercel's built-in fetch refuses
//  to connect — code DEPTH_ZERO_SELF_SIGNED_CERT.
//
//  Setting INSECURE_BACKEND_TLS=true on Vercel activates a per-request
//  undici dispatcher that skips certificate verification. Crucially:
//
//    • It is OFF by default. Without the env var, fetch behaves
//      identically to the standard global fetch.
//    • It is SCOPED. Only outbound calls that go through this helper
//      use the insecure dispatcher. Other Node TLS code (next-auth's
//      OIDC callbacks, Supabase admin client, etc.) keeps full
//      validation.
//    • It is LOUD. Every request logs a warning to stderr so anyone
//      tailing function logs sees the bypass is active.
//
//  REMOVE THE ENV VAR (and ideally this entire shim) the moment your
//  backend has a valid certificate. Self-signed-cert tolerance in
//  production is a vector for MITM token theft — every CAPA-aware
//  HSE Manager would call this a finding.
// ════════════════════════════════════════════════════════════════════════

import { Agent, fetch as undiciFetch } from "undici";

const INSECURE = process.env.INSECURE_BACKEND_TLS === "true";

// Lazily build the insecure dispatcher only when the flag is on. Built
// once per Lambda warm-start so every request reuses the same agent
// (connection pooling).
let insecureAgent: Agent | null = null;
function getInsecureAgent(): Agent {
  if (!insecureAgent) {
    insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });
    // eslint-disable-next-line no-console
    console.warn(
      "⚠️  [backend-fetch] INSECURE_BACKEND_TLS=true — Vercel will accept " +
        "self-signed / invalid certificates from the backend. Remove this " +
        "env var as soon as the backend cert is fixed."
    );
  }
  return insecureAgent;
}

export type BackendFetchOptions = RequestInit & {
  /** Override the default 30s timeout. Pass null to disable. */
  timeoutMs?: number | null;
};

/**
 * Fetch helper used for every Vercel → Python backend request. Honours
 * INSECURE_BACKEND_TLS at runtime, applies a default 30s abort timeout,
 * and never silently swallows errors — callers see the real failure
 * code so the catch-all proxy can surface a meaningful 502.
 */
export async function backendFetch(
  url: string,
  init: BackendFetchOptions = {}
): Promise<Response> {
  const { timeoutMs = 30_000, ...rest } = init;
  const ctrl = new AbortController();
  const timer =
    timeoutMs === null
      ? null
      : setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    if (INSECURE) {
      // Per-request log so it's obvious in Vercel function logs which
      // calls are bypassing cert validation. The agent itself only
      // logs once at first construction.
      // eslint-disable-next-line no-console
      console.warn(`[backend-fetch] insecure-TLS request → ${url}`);
      // undici.fetch has a slightly different Response type but it's
      // structurally identical for our consumers.
      const res = (await undiciFetch(url, {
        ...rest,
        signal: ctrl.signal,
        dispatcher: getInsecureAgent()
      } as any)) as unknown as Response;
      return res;
    }
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** Used by /api/diagnostics to surface the bypass state in the JSON. */
export function isInsecureBackendTlsActive(): boolean {
  return INSECURE;
}
