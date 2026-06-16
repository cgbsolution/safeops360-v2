"use client";

import { ReactNode, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Hook + component for client-side permission gating. Fetches the caller's
// permissions and caches them in module memory keyed by user.id, so a different
// user logging in after a sign-out doesn't see the previous user's permissions.
//
// IMPORTANT: This is a UX improvement, not a security control. The actual
// security boundary is the API authorize() helper. Do not assume hiding a
// button stops anyone — it just keeps the UI tidy.

let cachedPermissions: Record<string, boolean> | null = null;
let cachedForUserId: string | null = null;
let cacheLoadedAt = 0;
// 5-minute cache. Permission grants change rarely outside the admin UI;
// the longer cache means most page renders re-use the same in-memory map
// instead of hitting the proxy → Python → DB chain. The Can component
// rendered ~15 times on a typical dashboard page.
const CACHE_MS = 5 * 60_000;
let inflight: Promise<Record<string, boolean>> | null = null;

async function fetchPermissions(userId: string | null): Promise<Record<string, boolean>> {
  // Cache is keyed by userId — if the active user changes, drop the cache.
  if (cachedForUserId !== userId) {
    cachedPermissions = null;
    cachedForUserId = userId;
    cacheLoadedAt = 0;
  }
  if (cachedPermissions && Date.now() - cacheLoadedAt < CACHE_MS) {
    return cachedPermissions;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch("/api/auth/permissions");
      if (!r.ok) return {};
      const j = await r.json();
      const perms = j.permissions ?? {};
      // Don't cache empty maps — let the next call retry. Avoids the "stale
      // empty permissions for 30s" bug after a fresh login.
      if (Object.keys(perms).length > 0) {
        cachedPermissions = perms;
        cacheLoadedAt = Date.now();
      }
      return perms;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function refreshPermissions() {
  cachedPermissions = null;
  cachedForUserId = null;
  cacheLoadedAt = 0;
}

export function usePermissions() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id ?? null;
  // IMPORTANT: do NOT seed useState with the module-level cache. On the server
  // the cache is always null, but on the client (after the first page nav) it
  // already has values — that mismatch was triggering hydration errors on
  // every page that used <Can> (eg. headers with permission-gated buttons).
  // Start with null on both sides; useEffect populates from the cache or API.
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (!userId) {
      setPerms({});
      return;
    }
    // Use cached value synchronously if available, AFTER hydration completes.
    if (cachedPermissions && cachedForUserId === userId) {
      setPerms(cachedPermissions);
      return;
    }
    let cancelled = false;
    fetchPermissions(userId).then((p) => {
      if (!cancelled) setPerms(p);
    });
    return () => { cancelled = true; };
  }, [userId]);

  return perms ?? {};
}

export function usePermission(code: string): boolean {
  const perms = usePermissions();
  return !!perms[code];
}

// Hides children unless the caller holds `permission`. Use the `fallback`
// prop to render an alternative — e.g., a tooltip-style hint — when denied.
export function Can({
  permission,
  children,
  fallback = null
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = usePermission(permission);
  return <>{allowed ? children : fallback}</>;
}

// Inverse of Can — renders children only when the user LACKS the permission.
// Useful for "read-only" hints next to fields the user can see but not edit.
export function CanNot({
  permission,
  children
}: {
  permission: string;
  children: ReactNode;
}) {
  const allowed = usePermission(permission);
  return <>{allowed ? null : children}</>;
}
