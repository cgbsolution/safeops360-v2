// Catch-all proxy. Every /api/* call from the browser is forwarded to the
// Python backend with the caller's session token.
//
// Why a proxy instead of pointing the browser directly at Python:
//   - Avoids exposing BACKEND_URL to the client (no NEXT_PUBLIC_ leak)
//   - Keeps cookie / CORS handling simple — same-origin from the browser
//   - Lets the Next.js layer add headers, log, or short-circuit if needed
//
// Routes that DON'T go through here:
//   - /api/auth/[...nextauth] — NextAuth's own handler (unchanged)
//   - /api/auth/permissions   — small per-route proxy (more specific path
//                               wins over this catch-all in Next.js)
//   - /api/anomalies/*        — still owned by the Node side until we port
//                               the AnomalyDetectionAgent to Python
//   - /api/observations/[id]/attachments/* — Python observations module
//                               doesn't yet have attachment endpoints

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mintBackendToken } from "@/lib/backend-token";
import { backendFetch } from "@/lib/backend-fetch";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

// Connection pooling is handled by the shared, keep-alive-tuned undici agent
// in src/lib/backend-fetch.ts. See the comment there for why socket lifetime
// is deliberately short (frozen-lambda stale-socket race).

// Connection failures where the TCP connection was never established, so the
// backend provably never saw the request. Safe to replay for ANY method.
const RETRY_ANY_METHOD = new Set([
  "ECONNREFUSED",
  "UND_ERR_CONNECT_TIMEOUT",
  "ENOTFOUND",
  "EAI_AGAIN"
]);

// Socket died mid-flight. Almost always the idle-socket reuse race (the
// request never went out), but it *could* in principle fire after the backend
// already processed the call — so these are only replayed for GET/HEAD, where
// a duplicate is harmless. A retried POST could double-create a record, which
// in an EHS system is worse than showing an error.
const RETRY_IDEMPOTENT_ONLY = new Set(["ECONNRESET", "UND_ERR_SOCKET", "EPIPE"]);

// Pause between the two attempts. Deliberately short — this runs inside a
// serverless request a user is waiting on — but long enough that the retry is
// a second chance rather than a second simultaneous hit.
const RETRY_BACKOFF_MS = Number(process.env.BACKEND_RETRY_BACKOFF_MS ?? 250);

function shouldRetry(code: string, method: string): boolean {
  if (RETRY_ANY_METHOD.has(code)) return true;
  const idempotent = method === "GET" || method === "HEAD";
  return idempotent && RETRY_IDEMPOTENT_ONLY.has(code);
}

// Paths the proxy must NOT swallow — they have their own dedicated handlers
// in this app and must keep working for the Node-only features.
const PASSTHROUGH_PREFIXES = ["auth/", "anomalies", "diagnostics"];

async function forward(req: NextRequest, params: { path: string[] }): Promise<NextResponse> {
  if (!BACKEND_URL) {
    return NextResponse.json(
      {
        error: "BACKEND_URL is not configured",
        reason: "The Next.js deployment has no BACKEND_URL environment variable set.",
        hint: "Visit /api/diagnostics for a full configuration check, then add BACKEND_URL on Vercel → Settings → Environment Variables and redeploy.",
      },
      { status: 503 }
    );
  }

  const path = params.path.join("/");
  if (PASSTHROUGH_PREFIXES.some((p) => path.startsWith(p))) {
    // Belt-and-suspenders — Next.js routing already prefers the more specific
    // handlers, but if anyone hits the catch-all for these paths we 404 so
    // the dedicated handler shows up in tooling.
    return NextResponse.json(
      { error: `Path '${path}' is not proxied; it has a dedicated handler.` },
      { status: 404 }
    );
  }

  const session = await getServerSession(authOptions);
  // Mint a FRESH bearer on every request. The session may also carry a
  // `backendAccessToken` from sign-in time, but that token has the TTL
  // Python configured at login — typically 60 minutes — so reusing it
  // makes every API call fail with 401 once the user has been logged in
  // longer than the TTL. Minting per-request (a single HMAC sign over
  // ~50 bytes) is cheap and gives a new 12-hour window every time.
  // The session bearer remains the fallback only when no userId is
  // available — that path is for service-to-service edge cases.
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  let token: string | undefined;
  if (userId) {
    token = (await mintBackendToken(userId, role ?? "WORKER")) ?? undefined;
  }
  if (!token) {
    token = (session?.user as any)?.backendAccessToken as string | undefined;
  }

  const url = `${BACKEND_URL.replace(/\/$/, "")}/api/${path}${req.nextUrl.search}`;

  const headers: Record<string, string> = {};
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;
  if (token) headers["authorization"] = `Bearer ${token}`;
  // Forward client IP for audit logging on the Python side
  const xff = req.headers.get("x-forwarded-for");
  if (xff) headers["x-forwarded-for"] = xff;
  // Forward the active factory/plant so per-factory module entitlement is
  // enforced server-side (cookie set by the licence provider — see
  // licence-provider.tsx). Absent → ceiling-only enforcement.
  const activePlant = req.cookies.get("safeops_active_plant")?.value;
  if (activePlant) headers["x-active-plant"] = activePlant;

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  // Server-Timing exposes per-hop latency in browser DevTools so we can see
  // whether the proxy or Python is the bottleneck for any given request.
  // Look for a "Timing" entry on the proxied response in the Network tab.
  //
  // Hard timeout so a cold/sleeping Python container can't hang the browser
  // indefinitely. Without this, the user saw a stuck loading skeleton and
  // thought the page was broken; with it, they get a clean 504 + retry button
  // instead.
  //
  // 25s, deliberately UNDER the 30s `maxDuration` in vercel.json. At 30s the
  // two ceilings were identical, so Vercel killed the function at the same
  // instant the abort fired and the platform's own bare 504 won the race — the
  // caller got an HTML gateway error with no JSON body, and every fetch that
  // reads `j.detail || j.error` fell through to its generic message. That is
  // why a timed-out schedule reported only "Please try again". Five seconds of
  // headroom is enough for this handler to serialise its own answer.
  const t0 = Date.now();
  let res: Response | undefined;
  let lastErr: any;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // backendFetch honours INSECURE_BACKEND_TLS=true (env-gated, off by
      // default) so we can keep working when the Python backend is on a
      // self-signed cert during the Let's Encrypt rollout.
      res = await backendFetch(url, {
        method: req.method,
        headers,
        body,
        cache: "no-store",
        timeoutMs: 25_000
      });
      break;
    } catch (err: any) {
      lastErr = err;
      const code = err?.cause?.code ?? err?.code ?? err?.name ?? "unknown";
      // The circuit is already open — the request never left this process, so
      // retrying it is pure waste and defeats the point of failing fast.
      if (code === "BACKEND_CIRCUIT_OPEN") break;
      if (attempt < 2 && shouldRetry(code, req.method)) {
        // eslint-disable-next-line no-console
        console.warn(`[proxy] ${code} on ${req.method} ${url} — retrying once after a short pause`);
        // Brief pause before the retry. The immediate re-attempt this replaces
        // doubled the request rate against a backend that was already failing,
        // which is what got Vercel's IPs banned on 2026-08-28. A connection
        // that just timed out will not succeed 0ms later.
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
        continue;
      }
      break;
    }
  }
  if (!res) {
    const err: any = lastErr;
    const code = err?.cause?.code ?? err?.code ?? err?.name ?? "unknown";
    // Log full detail to Vercel function logs so you can see it in
    // Vercel → Deployments → Logs without needing to reproduce.
    // eslint-disable-next-line no-console
    console.error("[proxy] upstream fetch failed", {
      url,
      code,
      message: err?.message,
      method: req.method
    });
    if (err?.name === "AbortError" || code === "AbortError") {
      return NextResponse.json(
        {
          error: "Backend timed out",
          reason: "The Python backend did not respond within 25s — it may be cold-starting or overloaded.",
          code,
          hint: "Retry once. If persistent, check Dokploy resource limits and visit /api/diagnostics.",
        },
        { status: 504 }
      );
    }
    // Surface the real failure mode (TLS / DNS / connection refused / etc.)
    // instead of letting it crash the function.
    let reason = "Network error reaching the backend.";
    if (code.includes("CERT") || code.includes("TLS") || code.includes("SSL")) {
      reason = "TLS certificate verification failed on the backend.";
    } else if (code === "ENOTFOUND") {
      reason = "DNS lookup failed for BACKEND_URL — verify the hostname.";
    } else if (code === "ECONNREFUSED") {
      reason = "Backend refused the connection — server is down or port closed.";
    }
    return NextResponse.json(
      {
        error: "Backend unreachable",
        reason,
        code,
        hint: "Visit /api/diagnostics for a full configuration check.",
      },
      { status: 502 }
    );
  }
  const upstreamMs = Date.now() - t0;

  // 204 / 205 / 304 are "null body" statuses — passing ANY body to the
  // NextResponse constructor with these statuses throws "Response
  // constructed with null body status cannot have body". That used to
  // turn every successful DELETE (Python returns 204) into a 500 here,
  // so the browser saw "Delete failed" even though the row was gone.
  const isNullBody = res.status === 204 || res.status === 205 || res.status === 304;
  const totalMs = Date.now() - t0;
  const responseHeaders: Record<string, string> = {
    "Server-Timing": `python;dur=${upstreamMs};desc="upstream", proxy;dur=${totalMs - upstreamMs};desc="proxy"`
  };

  if (isNullBody) {
    return new NextResponse(null, { status: res.status, headers: responseHeaders });
  }

  const upstreamCt = res.headers.get("content-type") ?? "application/json";
  responseHeaders["content-type"] = upstreamCt;
  // Forward the download filename so file exports keep their name.
  const cd = res.headers.get("content-disposition");
  if (cd) responseHeaders["content-disposition"] = cd;

  // Text-like responses (JSON / CSV / HTML / XML) are safe to round-trip as a
  // string. BINARY responses (xlsx, pdf, images, zip, octet-stream) MUST be
  // passed through as raw bytes — `res.text()` decodes them as UTF-8 and
  // corrupts the file (e.g. an .xlsx zip's central directory), so Excel and
  // other readers reject the download. This is why report Excel exports were
  // "not working" in production while CSV worked.
  const isText = /^(?:text\/|application\/(?:json|csv|xml|javascript|xhtml\+xml|x-www-form-urlencoded)\b)/i.test(upstreamCt);
  if (isText) {
    const responseText = await res.text();
    return new NextResponse(responseText, { status: res.status, headers: responseHeaders });
  }
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, { status: res.status, headers: responseHeaders });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params));
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params));
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params));
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params));
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params));
}
