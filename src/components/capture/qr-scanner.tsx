"use client";

// QR scan modal — the "fastest path" location entry (spec screen 1).
// Uses the native BarcodeDetector when available (fast), and falls back to the
// jsQR decoder everywhere else (desktop Chrome/Firefox/Safari, older Androids)
// so the "Scan QR" button ALWAYS works given a camera — the JS fallback the
// spec asked for. Accepted payloads:
//   safeops:loc:<areaId>:<equipId> → area + asset in ONE scan (spec §4 banner)
//   safeops:area:<areaId>          → area
//   safeops:equipment:<equipId>    → equipment (area optional, second scan)
//   a bare areaId that matches the technician's plant areas
// All formats resolve on-device (no server round-trip) so QR entry keeps
// working in dead zones — the offline-first QR decision.

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import jsQR from "jsqr";
import type { Lang } from "@/lib/capture/i18n";
import { t } from "@/lib/capture/i18n";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

// True whenever the device has a camera we can open — the scan button shows,
// and the modal decodes via BarcodeDetector or the jsQR fallback.
export function qrSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export type QrResult = { areaId?: string; equipmentId?: string };

export function parseQrPayload(raw: string, knownAreaIds: Set<string>): QrResult | null {
  const value = raw.trim();
  // combined Area + Asset sticker — one scan fills the whole Context Banner
  if (value.startsWith("safeops:loc:")) {
    const [areaId, equipmentId] = value.slice("safeops:loc:".length).split(":");
    const out: QrResult = {};
    if (areaId) out.areaId = areaId;
    if (equipmentId) out.equipmentId = equipmentId;
    return out.areaId || out.equipmentId ? out : null;
  }
  if (value.startsWith("safeops:area:")) return { areaId: value.slice("safeops:area:".length) };
  if (value.startsWith("safeops:equipment:")) return { equipmentId: value.slice("safeops:equipment:".length) };
  if (knownAreaIds.has(value)) return { areaId: value };
  return null;
}

export function QrScannerModal({
  lang,
  knownAreaIds,
  onResult,
  onClose,
}: {
  lang: Lang;
  knownAreaIds: Set<string>;
  onResult: (result: QrResult) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    stopRef.current = false;
    let stream: MediaStream | null = null;

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // Prefer the native detector; otherwise decode frames with jsQR.
        const hasNative = "BarcodeDetector" in window;
        const detector = hasNative
          ? new (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector({ formats: ["qr_code"] })
          : null;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = async () => {
          if (stopRef.current || !videoRef.current) return;
          const v = videoRef.current;
          try {
            let raw: string | null = null;
            if (detector) {
              const codes = await detector.detect(v);
              raw = codes[0]?.rawValue ?? null;
            } else if (ctx && v.readyState >= 2 && v.videoWidth > 0) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              raw = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
            if (raw) {
              const parsed = parseQrPayload(raw, knownAreaIds);
              if (parsed) {
                stopRef.current = true;
                onResult(parsed);
                return;
              }
              setError(t("qrNotFound", lang)); // a code was read but not one of ours
            }
          } catch {
            /* per-frame failure — keep scanning */
          }
          setTimeout(tick, detector ? 250 : 120);
        };
        void tick();
      } catch {
        setError(t("qrNotFound", lang));
      }
    }

    void run();
    return () => {
      stopRef.current = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [knownAreaIds, lang, onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4">
        <span className="text-lg font-semibold text-white">{t("scanQr", lang)}</span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
        >
          <X className="h-7 w-7" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-56 rounded-2xl border-4 border-[#C9A961]" />
        </div>
      </div>
      <div className="p-4 text-center text-sm text-white/80">{error ?? t("qrHint", lang)}</div>
    </div>
  );
}
