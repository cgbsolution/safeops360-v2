"use client";

import { Loader2, MapPin, MapPinOff } from "lucide-react";
import type { GeolocationStatus, GpsCoords } from "@/hooks/use-geolocation";

type Props = {
  status: GeolocationStatus;
  coords: GpsCoords | null;
  error: string | null;
  onRetry: () => void;
  className?: string;
};

export function GpsCaptureStatus({ status, coords, error, onRetry, className }: Props) {
  const base = "text-xs flex items-center gap-1.5";
  const cls = className ? `${base} ${className}` : base;

  if (status === "granted" && coords) {
    const acc = coords.accuracy ? ` ±${Math.round(coords.accuracy)}m` : "";
    return (
      <div className={`${cls} text-emerald-700`}>
        <MapPin size={12} />
        GPS captured: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}{acc}
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className={`${cls} text-slate-500`}>
        <Loader2 size={12} className="animate-spin" />
        Acquiring GPS fix…
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className={`${cls} text-slate-500`}>
        <MapPinOff size={12} />
        GPS not supported in this browser.
      </div>
    );
  }

  return (
    <div className={`${cls} text-amber-700`}>
      <MapPinOff size={12} />
      <span>{error ?? "Could not capture GPS."}</span>
      <button
        type="button"
        onClick={onRetry}
        className="underline underline-offset-2 hover:text-amber-900"
      >
        Use my location
      </button>
    </div>
  );
}
