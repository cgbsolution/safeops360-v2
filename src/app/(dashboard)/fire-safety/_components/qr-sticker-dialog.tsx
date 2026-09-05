"use client";

// The sticker you print and put on the cylinder.
//
// Shows the QR at roughly the size it will be applied, says in plain words what
// scanning it does, and offers the two formats that actually matter:
//
//   SVG  vector — the one to print from. A 25 mm label run off a screen-
//        resolution PNG is a label that will not scan reliably in a corridor.
//   PNG  raster — for pasting into a work order, an email or a slide.
//
// The preview is deliberately a live `<img>` against the API rather than a
// client-side re-encode. Two encoders would eventually disagree about what is on
// the sticker versus what the server thinks is on it, and the one printed is the
// one that has to match.

import * as React from "react";
import { Download, ExternalLink, Loader2, QrCode, X } from "lucide-react";
import { DISPLAY_FONT, MX } from "../lib";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type QrTarget = {
  id: string;
  equipmentCode: string;
  allottedSerialNo?: string | null;
  location?: string | null;
  type?: string | null;
  /** The asset's OPAQUE sticker value (`FireEquipment.qrToken`), not its id.
   *  Null until the backfill has minted one — the dialog says so rather than
   *  showing a scan URL that resolves to nothing. */
  qrTokenValue?: string | null;
};

export function QrStickerDialog({
  target,
  onClose,
}: {
  target: QrTarget | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [target?.id]);

  if (!target) return null;

  const png = `/api/fire/assets/${target.id}/qr.png?scale=10`;
  const svg = `/api/fire/assets/${target.id}/qr.svg`;
  // Built from the stored token, never from the asset id. The id used to be
  // what the label encoded, which is exactly the leak this change closes — a
  // scan URL shown on screen is the same string that goes on the cylinder.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const scanUrl = target.qrTokenValue
    ? `${origin}/fire-safety/scan/${target.qrTokenValue}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`QR sticker for ${target.equipmentCode}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between rounded-t-xl px-4 py-3"
          style={{ background: MX.navy }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: MX.gold }}>
              <QrCode size={11} /> Asset sticker
            </div>
            <div className="truncate text-[15px] font-semibold text-white" style={{ fontFamily: DISPLAY_FONT }}>
              {target.equipmentCode}
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-auto w-auto rounded p-1 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        <div className="p-4">
          <Card
            className="mx-auto flex h-[210px] w-[210px] items-center justify-center rounded-lg border bg-white shadow-none"
            style={{ borderColor: MX.iceLine }}>
            {!loaded && !failed && <Loader2 size={18} className="animate-spin" style={{ color: MX.muted }} />}
            {failed ? (
              <span className="px-4 text-center text-[11.5px]" style={{ color: MX.red }}>
                The QR could not be generated. Check that the asset is still in the register.
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={png}
                alt={`QR code for ${target.equipmentCode}`}
                className={loaded ? "h-[200px] w-[200px]" : "hidden"}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            )}
          </Card>

          <div className="mt-2.5 text-center">
            <div className="text-[12.5px] font-semibold" style={{ color: MX.navy }}>
              {target.allottedSerialNo ? `Tag ${target.allottedSerialNo}` : target.equipmentCode}
            </div>
            {target.location && (
              <div className="text-[11px]" style={{ color: MX.muted }}>
                {target.location}
              </div>
            )}
          </div>

          <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: MX.muted }}>
            Scanning this with any phone camera opens <strong style={{ color: MX.ink }}>this unit&rsquo;s
            checklist</strong> for the current period — no app needed. The person scanning still has
            to sign in and hold the permission to fill it in.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={svg}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white"
              style={{ background: MX.navy }}
            >
              <Download size={13} /> SVG — print this
            </a>
            <a
              href={png}
              download={`${target.equipmentCode}-qr.png`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium"
              style={{ borderColor: MX.iceLine, color: MX.navy }}
            >
              <Download size={13} /> PNG
            </a>
          </div>

          {/* Printed small so a sticker can be re-created by hand, and so anyone
              debugging a scan can see exactly what the label encodes. */}
          <div className="mt-3 rounded-lg px-2.5 py-2" style={{ background: MX.ice }}>
            <div className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: MX.muted }}>
              Encoded link
            </div>
            {scanUrl ? (
              <a
                href={`/fire-safety/scan/${target.qrTokenValue}`}
                className="inline-flex items-center gap-1 break-all text-[10.5px] hover:underline"
                style={{ color: MX.navy }}
              >
                {scanUrl} <ExternalLink size={9} className="shrink-0" />
              </a>
            ) : (
              // No token yet. Saying so beats printing a link that scans fine
              // and resolves to nothing — the failure would otherwise surface
              // months later, on a cylinder, to someone who cannot fix it.
              <p className="text-[10.5px]" style={{ color: MX.amber }}>
                No QR token has been issued for this asset yet, so a label cannot be printed.
                An administrator needs to run the fire QR backfill.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
