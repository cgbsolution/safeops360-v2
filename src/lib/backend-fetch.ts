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
import {
  circuitOpenError,
  isConnectionError,
  recordFailure,
  recordSuccess,
  shouldAttempt,
} from "./backend-circuit";

const INSECURE = process.env.INSECURE_BACKEND_TLS === "true";

// ── Keep-alive tuning: the fix for random "Backend unreachable" ──────────
//
// Vercel freezes a serverless function between invocations, but undici's
// socket pool survives the freeze and still believes its pooled TCP
// connections are open. Meanwhile the reverse proxy in front of Python has
// long since closed them. On the next invocation undici grabs a dead socket,
// and the request fails instantly with ECONNRESET / UND_ERR_SOCKET — surfaced
// to the user as "Server unreachable" even though Python is perfectly healthy.
//
// This is why the API always looks fine when tested by hand: curl opens a
// fresh connection every time and structurally cannot hit the race.
//
// Holding sockets for only a few seconds means undici discards them as
// expired rather than reusing a corpse. Override with
// BACKEND_KEEPALIVE_TIMEOUT_MS if the proxy's idle timeout is known.
const KEEP_ALIVE_MS = Number(process.env.BACKEND_KEEPALIVE_TIMEOUT_MS ?? 4_000);

// Built once per warm start so connection pooling still works within a burst
// of requests — we shorten socket lifetime, we don't disable pooling.
let agent: Agent | null = null;
function getAgent(): Agent {
  if (!agent) {
    agent = new Agent({
      keepAliveTimeout: KEEP_ALIVE_MS,
      keepAliveMaxTimeout: KEEP_ALIVE_MS,
      ...(INSECURE ? { connect: { rejectUnauthorized: false } } : {})
    });
    if (INSECURE) {
      // eslint-disable-next-line no-console
      console.warn(
        "⚠️  [backend-fetch] INSECURE_BACKEND_TLS=true — Vercel will accept " +
          "self-signed / invalid certificates from the backend. Remove this " +
          "env var as soon as the backend cert is fixed."
      );
    }
  }
  return agent;
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

  // Fail fast while the circuit is open. On 2026-08-28 a backend outage turned
  // into a total one because every page kept retrying until the host's
  // intrusion-prevention layer banned Vercel's IPs — see backend-circuit.ts.
  if (!shouldAttempt()) {
    if (timer !== null) clearTimeout(timer);
    throw circuitOpenError();
  }

  try {
    if (INSECURE) {
      // Per-request log so it's obvious in Vercel function logs which
      // calls are bypassing cert validation. The agent itself only
      // logs once at first construction.
      // eslint-disable-next-line no-console
      console.warn(`[backend-fetch] insecure-TLS request → ${url}`);
    }
    // Always go through the shared keep-alive-tuned dispatcher (not the global
    // fetch) so the stale-socket protection above applies to every backend
    // call, not just the insecure-TLS ones. undici.fetch has a slightly
    // different Response type but it's structurally identical for our
    // consumers.
    const res = (await undiciFetch(url, {
      ...rest,
      signal: ctrl.signal,
      dispatcher: getAgent()
    } as any)) as unknown as Response;
    // The backend ANSWERED. Any status code — 401, 403, 500 — counts as
    // success here: the circuit protects against an unreachable host, not an
    // unhappy endpoint. Tripping on status would take the app down because one
    // route is failing.
    recordSuccess();
    return res;
  } catch (err) {
    if (isConnectionError(err)) recordFailure(err);
    throw err;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** Used by /api/diagnostics to surface the bypass state in the JSON. */
export function isInsecureBackendTlsActive(): boolean {
  return INSECURE;
}
