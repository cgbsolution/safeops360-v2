// Uptime probe for the Vercel → backend path.
//
// ─── WHY THIS ENDPOINT AND NOT JUST MONITORING THE BACKEND ────────────────
//
// On 2026-08-28 the backend was completely healthy — `/health` returned 200 in
// 0.26s from a laptop the whole time — while every Vercel serverless function
// got UND_ERR_CONNECT_TIMEOUT, because the host had blackholed Vercel's IPs.
// The app was fully down and a backend uptime check would have stayed green
// throughout.
//
// The only monitor that catches that is one running FROM Vercel, hitting the
// backend the same way the app does. That is this route. Point an uptime
// service (UptimeRobot's free tier is enough) at it every 5 minutes and alert
// on non-200.
//
// Deliberately unauthenticated: an uptime checker cannot log in, and this
// exposes nothing beyond reachability — no data, no config, no version. The
// backend URL is not echoed back, only whether it answered.

import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend-fetch";
import { circuitSnapshot } from "@/lib/backend-circuit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_URL =
  process.env.BACKEND_BASE_URL ?? process.env.BACKEND_URL ?? "";

export async function GET() {
  const startedAt = Date.now();

  if (!BACKEND_URL) {
    return NextResponse.json(
      { ok: false, reason: "BACKEND_URL_UNSET", circuit: circuitSnapshot() },
      { status: 503 },
    );
  }

  try {
    // Short timeout on purpose. A monitor asking "is this usable" should not
    // wait 30s; a backend taking that long is already an outage to a user.
    const res = await backendFetch(`${BACKEND_URL.replace(/\/$/, "")}/health`, {
      method: "GET",
      timeoutMs: 8_000,
    });
    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      // Reachable but unhealthy — a different alert from unreachable, and the
      // distinction is what tells you whether to look at the app or the network.
      return NextResponse.json(
        { ok: false, reason: "BACKEND_UNHEALTHY", backendStatus: res.status, latencyMs,
          circuit: circuitSnapshot() },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, latencyMs, circuit: circuitSnapshot() });
  } catch (err) {
    const code =
      (err as { code?: string; cause?: { code?: string } })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code ??
      "UNKNOWN";
    const latencyMs = Date.now() - startedAt;
    // THE case this exists for: the backend is fine from everywhere else and
    // unreachable from here. `code` is the evidence — UND_ERR_CONNECT_TIMEOUT
    // means packets are being dropped, which points at a firewall or IP ban
    // rather than at the application.
    return NextResponse.json(
      { ok: false, reason: "BACKEND_UNREACHABLE_FROM_VERCEL", code, latencyMs,
        circuit: circuitSnapshot() },
      { status: 502 },
    );
  }
}
