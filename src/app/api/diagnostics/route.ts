// Self-diagnosing config check. Hit this URL directly on the deployed
// site and it tells you in one JSON blob exactly which environment
// variable is missing, which target host is unreachable, or which
// secret is mismatched. Beats reading Vercel function logs at 2am.
//
// Usage:
//   https://safe-ops360.vercel.app/api/diagnostics
//
// Returns 200 if everything looks good, 503 if any required check fails.
// All output is sanitised — no secret values are echoed back, only
// presence + length so you can compare across environments without
// leaking anything.

import { NextResponse } from "next/server";
import { isInsecureBackendTlsActive } from "@/lib/backend-fetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckStatus = "ok" | "warn" | "fail";
type Check = {
  name: string;
  status: CheckStatus;
  message: string;
  fix?: string;
};

function describe(value: string | undefined): {
  present: boolean;
  length: number;
  preview: string;
} {
  if (!value) return { present: false, length: 0, preview: "" };
  return {
    present: true,
    length: value.length,
    preview:
      value.length > 24
        ? `${value.slice(0, 6)}…${value.slice(-4)}`
        : `${value.slice(0, 4)}…`
  };
}

function looksLikeLocalhost(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("0.0.0.0") ||
    /^http:\/\/(10|172|192)\./.test(url)
  );
}

async function pingBackend(url: string, timeoutMs: number): Promise<{
  reachable: boolean;
  status?: number;
  error?: string;
  ms: number;
}> {
  // Use the same backend-fetch helper as production traffic so the
  // diagnostic accurately reflects whether real requests will succeed
  // (including the INSECURE_BACKEND_TLS bypass when active).
  const { backendFetch } = await import("@/lib/backend-fetch");
  const t0 = Date.now();
  try {
    const res = await backendFetch(
      `${url.replace(/\/$/, "")}/api/auth/demo-user?email=ping@safeops360.in`,
      { method: "GET", cache: "no-store", timeoutMs }
    );
    return { reachable: true, status: res.status, ms: Date.now() - t0 };
  } catch (e: any) {
    return {
      reachable: false,
      error: e?.cause?.code ?? e?.code ?? e?.message ?? "unknown",
      ms: Date.now() - t0
    };
  }
}

export async function GET(req: Request) {
  // Optional gate: when DIAGNOSTICS_TOKEN is set, require a matching ?token=
  // and 404 otherwise so the endpoint isn't publicly discoverable. When unset,
  // it stays open (still sanitised — presence + length only, no secret values).
  const diagToken = process.env.DIAGNOSTICS_TOKEN;
  if (diagToken) {
    const provided = new URL(req.url).searchParams.get("token");
    if (provided !== diagToken) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const checks: Check[] = [];

  // ─── 1. Required env vars ─────────────────────────────────────────
  const BACKEND_URL = process.env.BACKEND_URL;
  const DATABASE_URL = process.env.DATABASE_URL;
  const JWT_SECRET = process.env.JWT_SECRET;
  const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
  const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

  // BACKEND_URL
  if (!BACKEND_URL) {
    checks.push({
      name: "BACKEND_URL",
      status: "fail",
      message: "Not set. The proxy will fall back to http://localhost:8000 which doesn't exist on serverless.",
      fix: "Vercel → Settings → Environment Variables → add BACKEND_URL with your Python backend's public HTTPS URL (no trailing slash)."
    });
  } else if (looksLikeLocalhost(BACKEND_URL)) {
    checks.push({
      name: "BACKEND_URL",
      status: "fail",
      message: `Set to ${BACKEND_URL} — looks like localhost or a private IP. Vercel functions cannot reach those.`,
      fix: "Replace with the public HTTPS URL of your deployed Python backend."
    });
  } else if (!BACKEND_URL.startsWith("https://")) {
    checks.push({
      name: "BACKEND_URL",
      status: "warn",
      message: `Set to ${BACKEND_URL} — not HTTPS. Mixed-content rules may block this.`,
      fix: "Use https:// — host your Python backend behind TLS."
    });
  } else if (BACKEND_URL.endsWith("/")) {
    checks.push({
      name: "BACKEND_URL",
      status: "warn",
      message: `Set to ${BACKEND_URL} — trailing slash will produce //api/... in proxied URLs. Most servers tolerate it but it's untidy.`,
      fix: "Remove the trailing slash."
    });
  } else {
    checks.push({
      name: "BACKEND_URL",
      status: "ok",
      message: `Set to ${BACKEND_URL}.`
    });
  }

  // DATABASE_URL
  const db = describe(DATABASE_URL);
  if (!db.present) {
    checks.push({
      name: "DATABASE_URL",
      status: "fail",
      message: "Not set. Prisma client will throw on every server-component render.",
      fix: "Add DATABASE_URL on Vercel — Supabase pooler URL with port 6543 and pgbouncer=true."
    });
  } else if (DATABASE_URL && !DATABASE_URL.includes("pgbouncer")) {
    checks.push({
      name: "DATABASE_URL",
      status: "warn",
      message: `Set (length ${db.length}) but missing pgbouncer=true. Connections to direct port may hit Supabase connection limits.`,
      fix: "Use the pooler URL: postgresql://...:6543/postgres?pgbouncer=true&connection_limit=10"
    });
  } else {
    checks.push({
      name: "DATABASE_URL",
      status: "ok",
      message: `Set (length ${db.length}).`
    });
  }

  // JWT_SECRET — used to sign tokens for the Python backend; MUST match Python's value
  const jwt = describe(JWT_SECRET);
  if (!jwt.present) {
    checks.push({
      name: "JWT_SECRET",
      status: "fail",
      message: "Not set. The proxy will mint tokens with an empty secret and Python will reject every API call with 401.",
      fix: "Set JWT_SECRET on Vercel to the EXACT same value your Python backend has (check safeops_360_bakend's .env)."
    });
  } else if (jwt.length < 16) {
    checks.push({
      name: "JWT_SECRET",
      status: "warn",
      message: `Set but only ${jwt.length} characters — shorter than the recommended 32+.`,
      fix: "Use at least 32 random characters: openssl rand -base64 32"
    });
  } else {
    checks.push({
      name: "JWT_SECRET",
      status: "ok",
      message: `Set (length ${jwt.length}). Confirm Python's JWT_SECRET has the same length.`
    });
  }

  // NEXTAUTH_SECRET
  const ns = describe(NEXTAUTH_SECRET);
  if (!ns.present) {
    checks.push({
      name: "NEXTAUTH_SECRET",
      status: "fail",
      message: "Not set. NextAuth will fail to sign sessions and the login page will throw.",
      fix: "Set NEXTAUTH_SECRET on Vercel to a 32+ character random string. Generate with: openssl rand -base64 32"
    });
  } else if (ns.length < 16) {
    checks.push({
      name: "NEXTAUTH_SECRET",
      status: "warn",
      message: `Set but only ${ns.length} characters.`,
      fix: "Use at least 32 random characters for production."
    });
  } else {
    checks.push({
      name: "NEXTAUTH_SECRET",
      status: "ok",
      message: `Set (length ${ns.length}).`
    });
  }

  // NEXTAUTH_URL
  if (!NEXTAUTH_URL) {
    checks.push({
      name: "NEXTAUTH_URL",
      status: "warn",
      message: "Not set. Vercel auto-injects NEXTAUTH_URL=VERCEL_URL but it's safer to set it explicitly."
    });
  } else if (!NEXTAUTH_URL.startsWith("https://")) {
    checks.push({
      name: "NEXTAUTH_URL",
      status: "warn",
      message: `Set to ${NEXTAUTH_URL} — not HTTPS. NextAuth callbacks may fail.`,
      fix: "Set to your Vercel URL: https://safe-ops360.vercel.app"
    });
  } else {
    checks.push({
      name: "NEXTAUTH_URL",
      status: "ok",
      message: `Set to ${NEXTAUTH_URL}.`
    });
  }

  // ─── 2. Backend reachability ──────────────────────────────────────
  if (BACKEND_URL && !looksLikeLocalhost(BACKEND_URL)) {
    const ping = await pingBackend(BACKEND_URL, 8000);
    if (ping.reachable) {
      // 200/400/404 from the backend = the proxy can reach it. Anything 2xx/4xx is "alive".
      if (ping.status && ping.status < 500) {
        checks.push({
          name: "Backend reachability",
          status: "ok",
          message: `Backend responded with HTTP ${ping.status} in ${ping.ms}ms. TLS handshake + routing OK.`
        });
      } else {
        checks.push({
          name: "Backend reachability",
          status: "warn",
          message: `Backend responded with HTTP ${ping.status} in ${ping.ms}ms — server reachable but returned 5xx.`,
          fix: "Check Python backend logs (Dokploy console)."
        });
      }
    } else {
      const errCode = ping.error ?? "unknown";
      let fix = "Verify the URL is publicly reachable: curl https://your-url/api/auth/demo-user?email=ping@safeops360.in";
      let msg = `Could not reach ${BACKEND_URL} after ${ping.ms}ms — error: ${errCode}.`;
      if (errCode.includes("CERT") || errCode.includes("TLS") || errCode.includes("SSL")) {
        fix = "TLS certificate problem. Re-issue the certificate on Dokploy/Caddy, or use a domain with a valid Let's Encrypt cert.";
      } else if (errCode.includes("ENOTFOUND") || errCode.includes("EAI")) {
        fix = "DNS lookup failed. Check the domain spelling.";
      } else if (errCode.includes("ECONNREFUSED")) {
        fix = "Backend is down or firewalled. Restart the Python container, check the port mapping.";
      } else if (errCode.includes("AbortError") || errCode.includes("timeout")) {
        fix = "Backend took longer than 8s to respond. It may be cold-starting — retry once. If persistent, check Dokploy resource limits.";
      }
      checks.push({
        name: "Backend reachability",
        status: "fail",
        message: msg,
        fix
      });
    }
  } else {
    checks.push({
      name: "Backend reachability",
      status: "fail",
      message: "Skipped — BACKEND_URL is missing or pointing to localhost. Fix that first."
    });
  }

  // ─── INSECURE_BACKEND_TLS bypass status ───────────────────────────
  // Loud advisory check so anyone reading the JSON knows TLS validation
  // is being skipped. Status is "warn" not "fail" — the system works,
  // but production should always run with this off.
  if (isInsecureBackendTlsActive()) {
    checks.push({
      name: "INSECURE_BACKEND_TLS",
      status: "warn",
      message:
        "ACTIVE — Vercel is accepting self-signed/invalid certificates from the backend. " +
        "Acceptable as a temporary workaround while Let's Encrypt is being set up on Dokploy. " +
        "DO NOT keep this on once the backend has a valid certificate.",
      fix: "Remove the INSECURE_BACKEND_TLS env var on Vercel and redeploy after the backend cert is valid (verify with: curl https://your-backend/ — should show no 'Not secure' warning)."
    });
  }

  // ─── Summary ──────────────────────────────────────────────────────
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const overall: CheckStatus = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "ok";

  const summary = {
    overall,
    failCount,
    warnCount,
    okCount: checks.filter((c) => c.status === "ok").length,
    deployment: {
      vercelEnv: process.env.VERCEL_ENV ?? "unknown",
      vercelUrl: process.env.VERCEL_URL ?? "unknown",
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    },
    nextStep:
      overall === "ok"
        ? "All checks passed. If login still fails, the issue is on the Python side — check JWT_SECRET parity (Python JWT_SECRET must equal Vercel JWT_SECRET) or look at Vercel function logs for the failing request."
        : overall === "warn"
          ? "Soft warnings — login may work but verify the warnings before going to production."
          : `${failCount} hard failures. Fix the items marked status:"fail" and redeploy (env-var changes need a fresh deploy)."`,
    checks
  };

  return NextResponse.json(summary, {
    status: overall === "fail" ? 503 : 200,
    headers: { "Cache-Control": "no-store" }
  });
}
