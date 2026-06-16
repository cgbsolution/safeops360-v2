// Helper for Next.js server components / route handlers to call the Python
// backend with a fresh Bearer token. Returns null when BACKEND_URL is
// unset — caller should fall back to the legacy Prisma path.
//
// Token strategy: mints a per-request HMAC bearer via mintBackendToken
// rather than reusing session.user.backendAccessToken. The session token
// has Python's login TTL (typically 60 min); reusing it makes every
// server-component call fail with "Signature has expired" once the user
// has been signed in longer than the TTL. Minting per request is cheap
// (one HMAC over ~50 bytes) and matches the catch-all proxy's behaviour.
//
// Example:
//   const observations = await backendFetch<{items: Obs[]}>("/api/observations");
//   if (observations) return observations.items;
//   // legacy Prisma path here

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { mintBackendToken } from "./backend-token";

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export function isBackendEnabled(): boolean {
  return !!BACKEND_URL;
}

export async function backendFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T | null> {
  if (!BACKEND_URL) return null;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;

  // Mint a fresh bearer for this request. Fall back to the session
  // token only if minting fails (JWT_SECRET unset) — same precedence
  // as the catch-all proxy in src/app/api/[...path]/route.ts.
  let token: string | undefined;
  if (userId) {
    token = (await mintBackendToken(userId, role ?? "WORKER")) ?? undefined;
  }
  if (!token) {
    token = (session?.user as any)?.backendAccessToken as string | undefined;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${BACKEND_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Backend ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}
