// Permissions endpoint used by the <Can> component / usePermissions() hook.
// Python-only: this route is now a thin proxy to the backend. No Prisma
// fallback — all data access lives in Python.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mintBackendToken } from "@/lib/backend-token";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const BACKEND_TIMEOUT_MS = 2500;

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mint fresh on every call so an aged session-cached token (whose
  // TTL Python set at login time) doesn't 401 here. Local mint = cheap
  // HMAC sign + 12h validity, recomputed per-request.
  const role = (session?.user as any)?.role as string | undefined;
  let token = (await mintBackendToken(userId, role ?? "WORKER")) ?? undefined;
  if (!token) {
    token = (session?.user as any)?.backendAccessToken as string | undefined;
  }
  if (!token) {
    return NextResponse.json({ permissions: {} }, { status: 200 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const r = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/auth/permissions`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal
    });
    if (!r.ok) {
      return NextResponse.json({ permissions: {} }, { status: 200 });
    }
    const j = (await r.json()) as { permissions?: Record<string, boolean> };
    return NextResponse.json({ permissions: j.permissions ?? {} });
  } catch {
    return NextResponse.json({ permissions: {} }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
