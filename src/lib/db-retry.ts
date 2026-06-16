// Retry helper for transient Prisma / Supabase pooler errors.
//
// On Vercel serverless against Supabase Free tier (≤15 pooler connections),
// these three Prisma error codes are the noisy-but-recoverable ones:
//
//   P2024 — pool_timeout: pgbouncer kept us queued past the deadline
//   P1001 — can't reach the database (DNS blip, cold pooler)
//   P1017 — server has closed the connection (idle eviction)
//
// All three clear on a fresh attempt against a fresh connection. Without
// retry, the user sees "Dashboard unavailable" and has to mash F5 until
// they get lucky — the exact symptom the user reported.
//
// Strategy: max 3 attempts, exponential backoff with jitter (250ms,
// 600ms). Anything else (bad query, schema mismatch, auth) throws on the
// first attempt so we don't waste time retrying unrecoverable errors.

const TRANSIENT_CODES = new Set(["P2024", "P1001", "P1017", "P1008", "P1002"]);

type MaybePrismaErr = {
  code?: string;
  name?: string;
  message?: string;
};

function isTransient(err: unknown): boolean {
  const e = err as MaybePrismaErr;
  if (e?.code && TRANSIENT_CODES.has(e.code)) return true;
  const msg = (e?.message ?? "").toLowerCase();
  return (
    msg.includes("timed out fetching a new connection") ||
    msg.includes("connection pool") ||
    msg.includes("can't reach database") ||
    msg.includes("server has closed the connection") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; label?: string } = {}
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const label = opts.label ?? "db";
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) throw err;
      const backoff = 250 * Math.pow(2, i) + Math.random() * 150;
      const e = err as MaybePrismaErr;
      console.warn(
        `[${label}] transient DB error ${e?.code ?? e?.name ?? "?"} on attempt ${i + 1}/${attempts}, retrying in ${Math.round(backoff)}ms`
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}
