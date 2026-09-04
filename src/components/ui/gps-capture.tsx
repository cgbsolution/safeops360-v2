"use client";

import { useState } from "react";
import { Loader2, MapPin, MapPinOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useGeolocationPermission,
  type GeolocationPermission,
  type GeolocationStatus,
  type GpsCoords,
} from "@/hooks/use-geolocation";

type Props = {
  status: GeolocationStatus;
  coords: GpsCoords | null;
  error: string | null;
  onRetry: () => void;
  /** Optional — when omitted the component observes the permission itself. */
  permission?: GeolocationPermission;
  className?: string;
};

type Guide = { browser: string; steps: string[]; settingsPath?: string };

/** Once an origin is hard-blocked no amount of getCurrentPosition() will
 *  raise the browser prompt again — the setting has to be changed in the
 *  browser's own UI, which we cannot open from script. So tell the user
 *  exactly where it is for the browser they are actually using. */
function unblockGuide(): Guide {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isSafari = /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);

  if (isIOS) {
    return {
      browser: "iOS",
      steps: [
        "Open iOS Settings → Privacy & Security → Location Services and make sure it is on for your browser.",
        "In the browser, tap the “AA” / settings icon in the address bar → Website Settings → Location → Allow.",
        "Come back here and tap “I’ve allowed it — try again”.",
      ],
    };
  }
  if (isAndroid) {
    return {
      browser: "Android",
      steps: [
        "Tap the lock / tune icon at the left of the address bar.",
        "Tap Permissions → Location → Allow (reset it if it shows Blocked).",
        "Make sure Android location services are on, then tap “I’ve allowed it — try again”.",
      ],
    };
  }
  if (isFirefox) {
    return {
      browser: "Firefox",
      steps: [
        "Click the padlock at the left of the address bar.",
        "Under “Permissions”, click the ✕ next to “Access your location — Blocked” to clear it.",
        "Click “I’ve allowed it — try again”; Firefox will ask again and you can choose Allow.",
      ],
      settingsPath: "about:preferences#privacy → Permissions → Location",
    };
  }
  if (isSafari) {
    return {
      browser: "Safari",
      steps: [
        "Safari menu → Settings → Websites → Location.",
        "Find this site in the list and set it to “Allow”.",
        "Also check macOS System Settings → Privacy & Security → Location Services is on for Safari.",
      ],
    };
  }
  return {
    browser: isEdge ? "Edge" : "Chrome",
    steps: [
      "Click the tune / lock icon at the left of the address bar (next to the site name).",
      "Turn Location on — or open “Site settings” and set Location to Allow.",
      "Click “I’ve allowed it — try again” below (no page reload needed).",
    ],
    settingsPath: isEdge
      ? "edge://settings/content/location"
      : "chrome://settings/content/location",
  };
}

export function GpsCaptureStatus({
  status,
  coords,
  error,
  onRetry,
  permission,
  className,
}: Props) {
  const observed = useGeolocationPermission();
  const perm = permission ?? observed;
  const [showHelp, setShowHelp] = useState(false);

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

  if (status === "unsupported" || status === "insecure") {
    return (
      <div className={`${cls} text-slate-500`}>
        <MapPinOff size={12} />
        {error ?? "GPS not supported in this browser."}
      </div>
    );
  }

  // Hard-blocked: a retry cannot raise the prompt, so offer the way back in.
  if (status === "denied" && perm === "denied") {
    const guide = unblockGuide();
    return (
      <div className={className ? `text-xs ${className}` : "text-xs"}>
        <div className="flex items-center gap-1.5 text-amber-700">
          <ShieldAlert size={12} />
          <span>Location is blocked for this site — the browser will not ask again.</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setShowHelp((v) => !v)}
            className="h-auto p-0 text-xs text-amber-700 hover:text-amber-900"
          >
            {showHelp ? "Hide steps" : "How to allow"}
          </Button>
        </div>
        {showHelp && (
          <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-amber-900">
            <div className="font-medium">Allow location in {guide.browser}</div>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              {guide.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {guide.settingsPath && (
              <div className="mt-1.5 text-[11px] text-amber-800">
                Or paste this in the address bar:{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5">{guide.settingsPath}</code>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2 border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              I’ve allowed it — try again
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Dismissed the prompt, timed out, or position unavailable — asking again
  // genuinely works here, so keep the one-click retry.
  // `denied` with a promptable permission means the prompt was dismissed
  // rather than blocked, so don't reuse the hook's hard-block wording.
  const message =
    status === "denied"
      ? "Location permission not granted yet."
      : error ?? "Could not capture GPS.";

  return (
    <div className={`${cls} text-amber-700`}>
      <MapPinOff size={12} />
      <span>{message}</span>
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={onRetry}
        className="h-auto p-0 text-xs text-amber-700 hover:text-amber-900"
      >
        Use my location
      </Button>
    </div>
  );
}
