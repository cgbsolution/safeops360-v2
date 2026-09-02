"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GpsCoords = { lat: number; lng: number; accuracy?: number };

export type GeolocationStatus =
  | "idle"
  | "unsupported"
  | "insecure"
  | "loading"
  | "granted"
  | "denied"
  | "unavailable"
  | "timeout"
  | "error";

/** Live browser permission state for geolocation.
 *  "unknown"  — Permissions API unavailable (older Safari); we can only find
 *               out by calling getCurrentPosition and seeing what happens.
 *  "prompt"   — the browser will show its allow/block dialog on request.
 *  "denied"   — persistently blocked for this origin. getCurrentPosition
 *               fails instantly and NO prompt is ever shown again; the only
 *               way back is the browser's own site settings. */
export type GeolocationPermission = "unknown" | "prompt" | "granted" | "denied";

export type UseGeolocationOptions = {
  /** Request the OS to use GPS hardware. Defaults to true so the captured
   *  coords are usable for incident/permit location (IP-only fallback is
   *  often off by hundreds of metres on a desktop). */
  enableHighAccuracy?: boolean;
  /** Initial getCurrentPosition timeout. Defaults to 12s — long enough for
   *  a cold GPS fix on first acquisition. */
  timeoutMs?: number;
  /** Maximum age of a cached fix the browser may return. */
  maximumAgeMs?: number;
  /** Auto-request a fix as soon as the hook mounts. Defaults to true. */
  auto?: boolean;
};

export type UseGeolocationResult = {
  coords: GpsCoords | null;
  status: GeolocationStatus;
  error: string | null;
  /** Live permission state, kept in sync while the tab is open. */
  permission: GeolocationPermission;
  /** True when the origin is hard-blocked: retrying cannot raise a prompt,
   *  the user has to change it in browser site settings. */
  blocked: boolean;
  /** Re-run the fix request. When the permission is hard-blocked this is a
   *  no-op beyond refreshing the error — see `blocked`. */
  request: () => void;
  /** Convenience flag: true while waiting for the first or a retried fix. */
  isLoading: boolean;
};

const DEFAULTS: Required<Omit<UseGeolocationOptions, "auto">> & { auto: boolean } = {
  enableHighAccuracy: true,
  timeoutMs: 12_000,
  maximumAgeMs: 60_000,
  auto: true,
};

const BLOCKED_MESSAGE =
  "Location is blocked for this site. The browser will not ask again until you allow it in site settings.";

function permissionsApi(): Permissions | null {
  if (typeof navigator === "undefined") return null;
  return "permissions" in navigator && typeof navigator.permissions?.query === "function"
    ? navigator.permissions
    : null;
}

/** Observe the geolocation permission for this origin, live.
 *  Standalone so any UI (e.g. GpsCaptureStatus) can react to the user
 *  flipping the setting in the browser without a page reload. */
export function useGeolocationPermission(): GeolocationPermission {
  const [permission, setPermission] = useState<GeolocationPermission>("unknown");

  useEffect(() => {
    const perms = permissionsApi();
    if (!perms) return;

    let cancelled = false;
    let statusRef: PermissionStatus | null = null;
    const onChange = () => {
      if (!cancelled && statusRef) setPermission(statusRef.state as GeolocationPermission);
    };

    perms
      .query({ name: "geolocation" as PermissionName })
      .then((st) => {
        if (cancelled) return;
        statusRef = st;
        setPermission(st.state as GeolocationPermission);
        st.addEventListener("change", onChange);
      })
      // Firefox <90 and some embedded webviews reject the geolocation query.
      .catch(() => undefined);

    return () => {
      cancelled = true;
      statusRef?.removeEventListener("change", onChange);
    };
  }, []);

  return permission;
}

export function useGeolocation(opts: UseGeolocationOptions = {}): UseGeolocationResult {
  const { enableHighAccuracy, timeoutMs, maximumAgeMs, auto } = { ...DEFAULTS, ...opts };

  const [coords, setCoords] = useState<GpsCoords | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const permission = useGeolocationPermission();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const request = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("Geolocation is not supported in this browser.");
      return;
    }
    // Browsers only expose geolocation on https (or localhost). On a plain
    // http LAN address the call fails with a bare PERMISSION_DENIED, which
    // reads as "the user said no" — call it out for what it is instead.
    if (window.isSecureContext === false) {
      setStatus("insecure");
      setError("GPS needs a secure (https) connection. Open this site over https to capture location.");
      return;
    }
    setStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mountedRef.current) return;
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setStatus("granted");
        setError(null);
      },
      (err) => {
        if (!mountedRef.current) return;
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        if (err.code === 1) {
          setStatus("denied");
          setError(BLOCKED_MESSAGE);
        } else if (err.code === 2) {
          setStatus("unavailable");
          setError("Location is unavailable. Ensure device location services are on.");
        } else if (err.code === 3) {
          setStatus("timeout");
          setError("Location request timed out. Move to an area with better signal and retry.");
        } else {
          setStatus("error");
          setError(err.message || "Could not get location.");
        }
      },
      { enableHighAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
    );
  }, [enableHighAccuracy, timeoutMs, maximumAgeMs]);

  useEffect(() => {
    if (!auto) return;
    request();
    // intentionally only on mount; explicit request() handles retries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The user can allow location from browser site settings at any time. That
  // fires a permission change but never re-runs our request, so without this
  // the form keeps showing "denied" until a reload. Pick the fix up as soon
  // as the setting flips.
  const prevPermission = useRef<GeolocationPermission>("unknown");
  useEffect(() => {
    const prev = prevPermission.current;
    prevPermission.current = permission;
    if (prev === permission) return;
    if (permission === "granted" && !coords && status !== "loading") request();
    if (permission === "denied") {
      setStatus("denied");
      setError(BLOCKED_MESSAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  return {
    coords,
    status,
    error,
    permission,
    blocked: permission === "denied",
    request,
    isLoading: status === "loading",
  };
}
