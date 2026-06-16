"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GpsCoords = { lat: number; lng: number; accuracy?: number };

export type GeolocationStatus =
  | "idle"
  | "unsupported"
  | "loading"
  | "granted"
  | "denied"
  | "unavailable"
  | "timeout"
  | "error";

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
  /** Re-run the fix request. Safe to call even when previously denied —
   *  the browser will re-prompt if the user reset the permission. */
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

export function useGeolocation(opts: UseGeolocationOptions = {}): UseGeolocationResult {
  const { enableHighAccuracy, timeoutMs, maximumAgeMs, auto } = { ...DEFAULTS, ...opts };

  const [coords, setCoords] = useState<GpsCoords | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

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
          setError("Location permission denied. Allow location for this site to capture GPS.");
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

  return {
    coords,
    status,
    error,
    request,
    isLoading: status === "loading",
  };
}
