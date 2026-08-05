"use client";

// Client-side licence state. Two layers:
//   * deployment view  — /api/licensing/status (status, edition, limits…),
//   * per-factory set   — /api/licensing/modules?plantId=<active>, the modules
//     usable in the ACTIVE factory (signed ceiling minus the admin's per-factory
//     restrictions). hasModule() reflects the active factory, so nav + the route
//     guard gate per factory.
//
// The active plant is resolved from ?plantId= (the plant switcher) or the user's
// home plant, and written to the `safeops_active_plant` cookie so the API proxy
// forwards it and the Python API enforces per-factory access too.
//
// IMPORTANT: UX layer. The Python API is the real boundary — on a fetch error we
// fail OPEN here (assume operational + ceiling) since the API still enforces.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

export type LicenceModule = { code: string; name: string; group: string };

export type LicenceStatusView = {
  status: "ACTIVE" | "EXPIRING_SOON" | "GRACE" | "EXPIRED_LOCKED" | "INVALID" | "MISSING";
  isOperational: boolean;
  isLocked: boolean;
  daysToExpiry: number | null;
  edition: string | null;
  editionName: string | null;
  customerName: string | null;
  licenceType: string | null;
  deploymentMode: string | null;
  validFrom: string | null;
  validUntil: string | null;
  gracePeriodDays: number | null;
  warnDaysWindow: number | null;
  enabledModules: LicenceModule[];
  limits: { maxSites: number | null; maxUsers: number | null; maxFactories: number | null };
  featureFlags: Record<string, boolean>;
  isAdmin?: boolean;
  usage?: { users: number; sites: number; factories: number };
  installationId?: string | null;
  clockTamperWarning?: boolean;
  bindingWarning?: boolean;
  lastValidatedAt?: string;
  validationError?: string | null;
};

type LicenceContextValue = {
  loading: boolean;
  view: LicenceStatusView | null;
  enabledModules: Set<string>;
  isLocked: boolean;
  activePlantId: string | null;
  hasModule: (code: string) => boolean;
  refresh: () => Promise<void>;
};

const FALLBACK: LicenceContextValue = {
  loading: true,
  view: null,
  enabledModules: new Set(),
  isLocked: false,
  activePlantId: null,
  hasModule: () => true,
  refresh: async () => {},
};

const LicenceContext = createContext<LicenceContextValue>(FALLBACK);

function setActivePlantCookie(plantId: string | null) {
  if (typeof document === "undefined") return;
  if (plantId) {
    document.cookie = `safeops_active_plant=${encodeURIComponent(plantId)}; path=/; SameSite=Lax`;
  } else {
    document.cookie = "safeops_active_plant=; path=/; Max-Age=0; SameSite=Lax";
  }
}

export function LicenceProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const urlPlant = searchParams?.get("plantId") ?? null;
  const homePlant = (session?.user as any)?.plantId ?? null;
  const activePlantId: string | null = urlPlant ?? homePlant ?? null;

  const [view, setView] = useState<LicenceStatusView | null>(null);
  // effective module codes for the active factory; null until first load.
  const [effective, setEffective] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const qs = activePlantId ? `?plantId=${encodeURIComponent(activePlantId)}` : "";
      const [statusRes, modulesRes] = await Promise.all([
        fetch("/api/licensing/status", { cache: "no-store" }),
        fetch(`/api/licensing/modules${qs}`, { cache: "no-store" }),
      ]);
      setView(statusRes.ok ? ((await statusRes.json()) as LicenceStatusView) : null);
      if (modulesRes.ok) {
        const j = await modulesRes.json();
        setEffective(new Set<string>(j.enabledModules ?? []));
      } else {
        setEffective(null);
      }
    } catch {
      setView(null);
      setEffective(null);
    } finally {
      setLoading(false);
    }
  }, [activePlantId]);

  // Keep the cookie in sync so the proxy/API enforce the same active factory.
  useEffect(() => {
    setActivePlantCookie(activePlantId);
  }, [activePlantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<LicenceContextValue>(() => {
    const known = !!view;
    // hasModule prefers the per-factory effective set; falls back to the
    // deployment ceiling (from the status view) until it resolves, and fails
    // open while loading / on error.
    const ceiling = new Set((view?.enabledModules ?? []).map((m) => m.code));
    const set = effective ?? ceiling;
    return {
      loading,
      view,
      enabledModules: set,
      isLocked: known ? view!.isLocked : false,
      activePlantId,
      hasModule: (code: string) =>
        !known && !effective ? true : set.has(code),
      refresh,
    };
  }, [view, effective, loading, activePlantId, refresh]);

  return <LicenceContext.Provider value={value}>{children}</LicenceContext.Provider>;
}

export function useLicence(): LicenceContextValue {
  return useContext(LicenceContext);
}
