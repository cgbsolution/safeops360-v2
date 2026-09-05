"use client";

// EXPIRED_LOCKED / INVALID / MISSING restricted state (build prompt §7).
//
// When the licence is not operational the whole dashboard routes here. The ONLY
// permitted actions are: view licence status, export-my-data (so the client
// never loses their data), and upload a renewal licence. No operational module
// is reachable. Uploading a valid licence restores access live — no reinstall.

import { useState } from "react";
import { ShieldAlert, UploadCloud, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLicence } from "./licence-provider";
import { LicenceUpload } from "./licence-upload";

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  EXPIRED_LOCKED: {
    title: "Your licence has expired",
    body:
      "The grace period has ended, so operational modules are locked. Your data is safe — " +
      "you can export it below, and uploading a renewal licence restores full access instantly.",
  },
  INVALID: {
    title: "Your licence could not be validated",
    body:
      "The licence file failed signature or binding validation. Operational modules are locked " +
      "until a valid licence is uploaded. Your data is intact and exportable.",
  },
  MISSING: {
    title: "No licence found",
    body:
      "This installation has no licence file. Upload the licence supplied by Vizionforge to " +
      "activate your modules. Your data is intact and exportable.",
  },
};

export function LicenceLockedScreen() {
  const { view, refresh } = useLicence();
  const status = view?.status ?? "MISSING";
  const copy = STATUS_COPY[status] ?? STATUS_COPY.MISSING;
  const isAdmin = !!view?.isAdmin;
  const [busy, setBusy] = useState(false);

  async function exportData() {
    try {
      const r = await fetch("/api/licensing/export", { cache: "no-store" });
      if (!r.ok) return;
      const blob = new Blob([JSON.stringify(await r.json(), null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "safeops360-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* best effort */
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-primary-700 text-white font-bold text-xs shrink-0">
            S360
          </div>
          <div>
            <div className="font-bold text-slate-900">SafeOps360</div>
            <div className="text-xs text-slate-500">Licence required</div>
          </div>
        </div>

        <Card className="border-amber-300">
          <CardHeader className="flex flex-row items-center gap-2">
            <ShieldAlert className="text-amber-600" size={20} />
            <CardTitle className="text-amber-900">{copy.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">{copy.body}</p>
            {view?.customerName && (
              <div className="text-xs text-slate-500">
                Licensed to <span className="font-medium text-slate-700">{view.customerName}</span>
                {view.editionName ? ` · ${view.editionName}` : ""} · status{" "}
                <span className="font-mono">{status}</span>
              </div>
            )}
            {view?.validationError && (
              <pre className="text-[11px] bg-slate-100 rounded p-2 text-slate-600 whitespace-pre-wrap">
                {view.validationError}
              </pre>
            )}
            {/* Installation ID — admins copy this and send it to Vizionforge so
                a licence can be issued bound to THIS install (on-prem flow). */}
            {isAdmin && view?.installationId && (
              <Card className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 shadow-none">
                <div className="text-xs text-slate-500 mb-0.5">
                  Installation ID — send this to Vizionforge to receive your licence
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-slate-800 break-all">{view.installationId}</code>
                  <Button variant="link"
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(view.installationId!)} className="text-xs hover:underline shrink-0">
                    Copy
                  </Button>
                </div>
              </Card>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {/* Export is admin-only on the API; only offer it to admins. */}
              {isAdmin && (
                <Button variant="outline" onClick={exportData}>
                  <Download size={16} className="mr-1" /> Export my data
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={async () => {
                  setBusy(true);
                  await refresh();
                  setBusy(false);
                }}
                disabled={busy}
              >
                <RefreshCw size={16} className={`mr-1 ${busy ? "animate-spin" : ""}`} /> Re-check
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upload/renew is an ADMIN action — non-admins can't apply a licence,
            so show them a clear hand-off instead of a box they can't use. */}
        {isAdmin ? (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <UploadCloud className="text-primary-700" size={20} />
              <CardTitle>Upload / renew licence</CardTitle>
            </CardHeader>
            <CardContent>
              <LicenceUpload onApplied={refresh} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-5 text-sm text-slate-600">
              An administrator needs to upload a valid licence to restore access. Please contact your
              system administrator — once they apply the licence, click <span className="font-medium">Re-check</span> above.
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-slate-400">
          Need a licence? Contact Vizionforge Technologies to renew or convert your POC.
        </p>
      </div>
    </div>
  );
}
