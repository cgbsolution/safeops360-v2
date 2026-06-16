// Demo-user lookup for the login page role picker.
//
// Strategy:
//   1. Try the Python backend first (when BACKEND_URL is configured and reachable).
//   2. Fall back to a direct Prisma query if the backend is unreachable or returns
//      a non-OK response.  This ensures the demo picker always works even when the
//      Python service is stopped (local dev, cold-start, etc.).

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { backendFetch } from "@/lib/backend-fetch";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Lazy singleton — reuse across invocations in the same process.
let _prisma: PrismaClient | null = null;
function getPrisma() {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.endsWith("@safeops360.in")) {
    return NextResponse.json({ error: "demo email required" }, { status: 400 });
  }

  // ── 1. Try Python backend ────────────────────────────────────────────────
  const target = `${BACKEND_URL.replace(/\/$/, "")}/api/auth/demo-user?email=${encodeURIComponent(email)}`;
  try {
    const r = await backendFetch(target, { cache: "no-store", timeoutMs: 5_000 });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      if (j?.name) return NextResponse.json(j);
    }
  } catch {
    // Backend unreachable — fall through to Prisma fallback.
  }

  // ── 2. Prisma fallback — direct DB lookup ────────────────────────────────
  try {
    const user = await getPrisma().user.findUnique({
      where: { email },
      select: { name: true, role: true, designation: true }
    });
    if (user?.name) {
      return NextResponse.json({ name: user.name, role: user.role, designation: user.designation });
    }
    return NextResponse.json({ name: null }, { status: 404 });
  } catch (e: any) {
    console.error("[demo-user] prisma fallback failed", e?.message);
    return NextResponse.json({ name: null, error: "lookup failed" }, { status: 500 });
  }
}
