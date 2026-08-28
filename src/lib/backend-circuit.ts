// Circuit breaker for Vercel → Python backend calls.
//
// ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
//
// 2026-08-28: the backend became unreachable from Vercel and every page load
// kept retrying. Each failing request was attempted twice, and every screen
// polls several endpoints, so a few users refreshing produced hundreds of
// rapid connection attempts from a handful of IPs. That is indistinguishable
// from an attack, and the host's intrusion-prevention layer blackholed those
// IPs — turning a recoverable blip into a total outage that survived the
// original cause being fixed.
//
// The lesson is not "retry less". It is that a client hammering a struggling
// server makes the outage worse and can get itself banned. So after a run of
// consecutive failures this stops trying for a cooldown and fails fast.
//
// ─── WHAT IT DOES NOT DO ──────────────────────────────────────────────────
//
// State is per-process, and Vercel runs many short-lived, frozen serverless
// instances. So this is NOT a global breaker: ten warm instances can each hold
// their own circuit open. It still cuts the great majority of the storm,
// because a warm instance serves many requests and stops after the first few
// failures instead of retrying on every one.
//
// A genuinely global breaker needs shared state (Vercel KV / Redis). That is
// worth doing if this recurs; it is deliberately not done here because it adds
// a dependency and a new failure mode to the exact path that must degrade
// gracefully.
//
// It also only opens on CONNECTION failures — never on HTTP status codes. A
// backend returning 401, 403 or 500 is answering; tripping the breaker on
// those would take the whole app down because one endpoint is unhappy.

/** Consecutive connection failures before the circuit opens. */
const THRESHOLD = Number(process.env.BACKEND_CIRCUIT_THRESHOLD ?? 5);
/** How long to fail fast before allowing a probe. */
const COOLDOWN_MS = Number(process.env.BACKEND_CIRCUIT_COOLDOWN_MS ?? 30_000);

type State = "closed" | "open" | "half-open";

let consecutiveFailures = 0;
let openedAt = 0;
let probing = false;

/** Connection-level failures. An HTTP status is an answer, not a failure —
 *  see the note above about why status codes must never open the circuit. */
const CONNECTION_ERROR_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "UND_ERR_SOCKET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "ETIMEDOUT",
]);

export function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } })?.code
    ?? (err as { cause?: { code?: string } })?.cause?.code;
  return typeof code === "string" && CONNECTION_ERROR_CODES.has(code);
}

export function circuitState(): State {
  if (consecutiveFailures < THRESHOLD) return "closed";
  if (Date.now() - openedAt >= COOLDOWN_MS) return "half-open";
  return "open";
}

/**
 * Call before attempting a backend request.
 *
 * Returns false when the caller should fail fast without opening a socket.
 * In `half-open` exactly ONE caller is let through as a probe — if every
 * request were released at once, recovery would produce the same thundering
 * herd the breaker exists to prevent.
 */
export function shouldAttempt(): boolean {
  const state = circuitState();
  if (state === "closed") return true;
  if (state === "open") return false;
  if (probing) return false; // another request already holds the probe
  probing = true;
  return true;
}

export function recordSuccess(): void {
  if (consecutiveFailures >= THRESHOLD) {
    // eslint-disable-next-line no-console
    console.info("[circuit] backend recovered — closing circuit");
  }
  consecutiveFailures = 0;
  openedAt = 0;
  probing = false;
}

export function recordFailure(err?: unknown): void {
  probing = false;
  consecutiveFailures += 1;
  if (consecutiveFailures === THRESHOLD) {
    openedAt = Date.now();
    // Logged once, at the transition, not on every subsequent rejection —
    // the point is to stop generating load, including log volume.
    // eslint-disable-next-line no-console
    console.warn(
      `[circuit] ${THRESHOLD} consecutive backend connection failures — ` +
        `failing fast for ${Math.round(COOLDOWN_MS / 1000)}s to avoid hammering it. ` +
        `Last error: ${(err as { code?: string })?.code ?? "unknown"}`,
    );
  }
}

/** The error a caller raises when the circuit is open, shaped like a
 *  connection failure so existing `catch` blocks and the proxy's 502 mapping
 *  keep working unchanged. */
export function circuitOpenError(): Error & { code: string } {
  const e = new Error(
    "Backend is temporarily unreachable (circuit open — not retrying yet)",
  ) as Error & { code: string };
  e.code = "BACKEND_CIRCUIT_OPEN";
  return e;
}

/** For /api/health/upstream and diagnostics. */
export function circuitSnapshot() {
  return {
    state: circuitState(),
    consecutiveFailures,
    threshold: THRESHOLD,
    cooldownMs: COOLDOWN_MS,
    openedAt: openedAt ? new Date(openedAt).toISOString() : null,
  };
}

/** Test hook. */
export function resetCircuit(): void {
  consecutiveFailures = 0;
  openedAt = 0;
  probing = false;
}
