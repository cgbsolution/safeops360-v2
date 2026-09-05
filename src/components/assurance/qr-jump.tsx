"use client";

// WP-44 - QR jump into the conduct screen (docs/cams/09 §3.4).
//
// **One QR standard platform-wide.** The Field Capture PWA already scans
// `safeops:area:<id>` / `safeops:equipment:<id>` / `safeops:loc:<area>:<asset>`
// stickers via `components/capture/qr-scanner.tsx`. Those stickers are already
// on walls. Minting a second CAMS-specific scheme would mean a second sticker
// beside the first, so this REUSES the parser and the scanner outright — the
// brief's "one QR standard platform-wide" is a constraint, not an aspiration.
//
// What it adds is the destination: scanning a location sticker filters the
// conduct screen to the checkpoints allocated in that area, instead of leaving
// the auditor to find them in a list of 1,500.
//
// Degrades honestly: no camera, or an unrecognised sticker, says so rather than
// silently doing nothing.

import { useState } from "react";
import { QrCode, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  QrScannerModal,
  parseQrPayload,
  qrSupported,
  type QrResult,
} from "@/components/capture/qr-scanner";

export function QrJumpButton({
  knownAreaIds,
  onJump,
  label = "Scan area QR",
  className,
}: {
  /** Area ids in scope for THIS engagement — a sticker for another site should
   *  not silently filter the screen to nothing. */
  knownAreaIds: string[];
  onJump: (result: QrResult) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const known = new Set(knownAreaIds);
  const supported = qrSupported();

  function handle(result: QrResult) {
    setOpen(false);
    // A sticker from another site parses fine but means nothing here. Saying so
    // beats filtering the list to empty and letting the auditor conclude the
    // audit has no checkpoints.
    if (result.areaId && known.size && !known.has(result.areaId)) {
      setErr("That QR code is for an area outside this engagement's scope.");
      return;
    }
    setErr(null);
    onJump(result);
  }

  function submitManual() {
    const parsed = parseQrPayload(raw, known);
    if (!parsed) {
      setErr("That code was not recognised. Expected an area or equipment sticker.");
      return;
    }
    setManual(false);
    setRaw("");
    handle(parsed);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        onClick={() => (supported ? setOpen(true) : setManual(true))}
      >
        <QrCode size={14} /> {label}
      </Button>

      {err && (
        <p className="mt-1 text-[11px] text-amber-700" role="status">
          {err}
        </p>
      )}

      {open && (
        <QrScannerModal
          lang="en"
          knownAreaIds={known}
          onResult={handle}
          onClose={() => setOpen(false)}
        />
      )}

      {/* Camera-less fallback: a desk browser, a denied permission, or an
          unreadable sticker the auditor can still read the code off. */}
      {manual && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-sm sm:rounded-2xl">
            <div className="flex items-center gap-2">
              <ScanLine size={16} className="text-violet-700" />
              <h3 className="text-sm font-semibold text-slate-900">Enter the code</h3>
              <Button variant="ghost"
                type="button"
                onClick={() => setManual(false)} className="ml-auto"
                aria-label="Close">
                <X size={16} />
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {supported
                ? "Type the code printed under the QR sticker."
                : "This device has no camera available, so type the code printed under the sticker."}
            </p>
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="safeops:area:…"
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              autoFocus />
            {err && <p className="mt-1 text-[11px] text-rose-700">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setManual(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={submitManual} disabled={!raw.trim()}>
                Jump
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
