// Demo-user name search for the login page account picker.
//
// Same two-tier strategy as ../demo-user/route.ts:
//   1. Try the Python backend (/api/auth/demo-search) when reachable.
//   2. Fall back to a direct Prisma query so the picker keeps working when the
//      Python service is stopped (local dev, cold-start, etc.).
//
// Scope is deliberately limited to @safeops360.in demo accounts — this is a
// demo convenience, not a directory endpoint for real tenants.

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { backendFetch } from "@/lib/backend-fetch";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const MAX_RESULTS = 25;

// Lazy singleton — reuse across invocations in the same process.
let _prisma: PrismaClient | null = null;
function getPrisma() {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [], error: "search term must be at least 2 characters" }, { status: 400 });
  }

  // ── 1. Try Python backend ────────────────────────────────────────────────
  const target = `${BACKEND_URL.replace(/\/$/, "")}/api/auth/demo-search?q=${encodeURIComponent(q)}&limit=${MAX_RESULTS}`;
  try {
    const r = await backendFetch(target, { cache: "no-store", timeoutMs: 5_000 });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      if (Array.isArray(j?.results)) return NextResponse.json(j);
    }
  } catch {
    // Backend unreachable — fall through to Prisma fallback.
  }

  // ── 2. Prisma fallback — direct DB search ────────────────────────────────
  try {
    const users = await getPrisma().user.findMany({
      where: {
        email: { endsWith: "@safeops360.in" },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } }
        ]
      },
      select: {
        email: true,
        name: true,
        role: true,
        designation: true,
        department: true,
        plant: { select: { code: true, name: true } }
      },
      orderBy: { name: "asc" },
      take: MAX_RESULTS
    });
    return NextResponse.json({
      results: users.map((u) => ({
        email: u.email,
        name: u.name,
        role: u.role,
        designation: u.designation,
        department: u.department,
        plantCode: u.plant?.code ?? null,
        plantName: u.plant?.name ?? null
      }))
    });
  } catch (e: any) {
    console.error("[demo-search] prisma fallback failed", e?.message);
    return NextResponse.json({ results: [], error: "search failed" }, { status: 500 });
  }
}
