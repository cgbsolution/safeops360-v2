// Next.js → FastAPI bridge.
//
// Pure 3-tier architecture: Next.js server components and API routes call
// the FastAPI backend over HTTP instead of querying Postgres via Prisma
// directly. This file provides the helper that handles:
//   1. Base URL resolution (env-configurable; defaults to local dev)
//   2. JWT minting using the shared HMAC secret so FastAPI's existing
//      `get_current_user` dep validates the token without any backend code
//      change (both sides decode with HS256 against the same secret).
//   3. Error normalisation — FastAPI returns { detail: ... }; the helper
//      throws a typed error with the HTTP status + message.
//
// Required env vars:
//   - BACKEND_BASE_URL              (default: http://localhost:8000)
//   - BACKEND_JWT_SECRET            (must match FastAPI's JWT_SECRET)
//   - BACKEND_JWT_ALGORITHM         (default: HS256, must match backend)
//   - BACKEND_JWT_TTL_SECONDS       (default: 300 — short-lived per-request token)
//
// Usage (server components):
//   const studies = await backendFetch<{ items: HiraStudy[] }>(
//     "/api/hira/studies",
//     { method: "GET" }
//   );
//
// Usage (API route proxying a mutation):
//   const body = await req.json();
//   const result = await backendFetch("/api/hira/studies", {
//     method: "POST",
//     body
//   });
//   return NextResponse.json(result);

import { SignJWT } from "jose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const BASE_URL = process.env.BACKEND_BASE_URL ?? process.env.BACKEND_URL ?? "http://localhost:8000";
// Secret lookup order:
//   1. BACKEND_JWT_SECRET — explicit override for bridge tokens
//   2. JWT_SECRET         — shared with safeops_360_bakend/.env (preferred)
//   3. NEXTAUTH_SECRET    — last-resort fallback (only works if backend's
//                           JWT_SECRET happens to equal the NextAuth secret)
// The third fallback is intentional but fragile — most installs set
// JWT_SECRET distinct from NEXTAUTH_SECRET, which is why we prefer
// JWT_SECRET ahead of it.
const JWT_SECRET =
  process.env.BACKEND_JWT_SECRET ??
  process.env.JWT_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "";
const JWT_ALG = process.env.BACKEND_JWT_ALGORITHM ?? process.env.JWT_ALGORITHM ?? "HS256";
const JWT_TTL_SECONDS = parseInt(process.env.BACKEND_JWT_TTL_SECONDS ?? "300", 10);

if (!JWT_SECRET) {
  console.warn(
    "[backend/fetch] BACKEND_JWT_SECRET / NEXTAUTH_SECRET not set; backend calls will fail authentication."
  );
}

export class BackendError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
    this.name = "BackendError";
  }
}

export type BackendFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Override the user id used in the JWT. Default: from NextAuth session. */
  userId?: string;
  /** Skip auth (only legal for explicitly public endpoints — currently none). */
  skipAuth?: boolean;
  /** Forward query string. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Override base URL (testing). */
  baseUrl?: string;
  /** Pass-through fetch init for unusual cases. */
  headers?: Record<string, string>;
  /**
   * Response handling. Default "json". Use "raw" when the upstream returns
   * non-JSON (e.g. CSV export, file download).
   */
  responseType?: "json" | "raw" | "text";
};

async function mintToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_TTL_SECONDS)
    .sign(secret);
}

function buildQuery(query: BackendFetchOptions["query"]): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Resolve the user id to put in the JWT.
 * Order: explicit `opts.userId` → NextAuth session.user.id → throw.
 */
async function resolveUserId(opts: BackendFetchOptions): Promise<string> {
  if (opts.userId) return opts.userId;
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id as string | undefined;
  if (!id) {
    throw new BackendError(401, "No NextAuth session — cannot mint backend token");
  }
  return id;
}

export async function backendFetch<T = unknown>(
  path: string,
  opts: BackendFetchOptions = {}
): Promise<T> {
  const method = opts.method ?? "GET";
  const baseUrl = opts.baseUrl ?? BASE_URL;
  const url = `${baseUrl}${path}${buildQuery(opts.query)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...opts.headers
  };

  if (!opts.skipAuth) {
    const userId = await resolveUserId(opts);
    const token = await mintToken(userId);
    headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    headers,
    // Server-side: no cookies; backend trusts the bearer.
    cache: "no-store"
  };

  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    let detail: unknown = undefined;
    let message = `Backend ${method} ${path} failed: ${res.status}`;
    try {
      const data = await res.json();
      detail = data;
      if (data?.detail) message = String(data.detail);
      else if (data?.error) message = String(data.error);
    } catch {
      // body wasn't JSON; keep generic message
    }
    throw new BackendError(res.status, message, detail);
  }

  if (opts.responseType === "raw") {
    return res as unknown as T;
  }
  if (opts.responseType === "text") {
    return (await res.text()) as unknown as T;
  }
  // Default: JSON
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
