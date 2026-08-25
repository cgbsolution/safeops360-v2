"use client";

// "QR sticker" on the asset detail page.
//
// This page previously rendered the raw payload as a `<code>` string —
// `safeops:fire-asset:0e63348…` — which tells a human nothing and cannot be put
// on a cylinder. The asset detail page is the most obvious place to want the
// sticker (you are looking at the asset), so the button belongs here, opening the
// same dialog the register rows use rather than a second implementation.

import * as React from "react";
import { QrCode } from "lucide-react";
import { QrStickerDialog, QrTarget } from "../../_components/qr-sticker-dialog";

export function AssetQrButton({ target }: { target: QrTarget }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400"
        title="Print a QR sticker for this asset — scanning it opens this unit's checklist"
      >
        <QrCode size={14} /> QR sticker
      </button>
      {open && <QrStickerDialog target={target} onClose={() => setOpen(false)} />}
    </>
  );
}
