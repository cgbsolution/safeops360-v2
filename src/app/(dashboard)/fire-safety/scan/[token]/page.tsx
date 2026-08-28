// Where a scanned fire-asset sticker lands.
//
// Somebody is standing in a corridor holding a phone at an extinguisher. They
// pointed the stock camera app at the label, it opened a URL, and this is it.
// Everything about this page follows from that: they are on mobile data or none,
// they have one hand free, and they want the checklist for THIS cylinder — not a
// register, not a picker with two hundred rows.
//
// WHAT THE URL SEGMENT IS
// -----------------------
// An OPAQUE TOKEN, not the asset id. The id used to be printed on every label,
// which made one photographed sticker a map to every other and made "reissue
// this label" impossible — you cannot revoke a value derived from a primary key.
// The segment is now `FireEquipment.qrToken`, random and revocable.
//
// Stickers printed before that change carry the bare asset id, and the backend
// still resolves those while FIRE_QR_LEGACY_SCAN is on, reporting `resolvedVia:
// "legacy"`. This page says so — a stale label that still works today is worth
// mentioning while the person is standing at the cylinder, rather than letting
// them find out at cutover when it abruptly stops.
//
// WHY IT REDIRECTS INSTEAD OF RENDERING
// -------------------------------------
// An extinguisher has exactly one checklist (PIL/EHSD/CL/027-R1), so there is
// nothing to choose and a chooser would be a wasted tap. This page resolves the
// asset and sends them straight to that sheet, with the cylinder pre-selected.
//
// It only stops to ask when the asset genuinely carries several cadences — a fire
// alarm panel has daily, monthly, quarterly and annual sheets, and guessing lands
// them on the wrong one three times in four. Then it lists them, marks which are
// outstanding, and lets one tap decide.
//
// FAILURE IS EXPLAINED, NOT SWALLOWED
// -----------------------------------
// A sticker outlives the asset it was stuck on. Cylinders get condemned, assets
// get deleted, labels get moved to the wrong unit, and a plant with two sites may
// scan a sticker for a plant they cannot see. Each of those says what happened
// and offers the register, rather than a bare 404 in a corridor.

import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, QrCode } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { DISPLAY_FONT, MX } from "../../lib";

export const dynamic = "force-dynamic";

type Option = {
  templateCode: string;
  name: string;
  documentNo: string | null;
  frequency: "DAILY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  periodLabel: string;
  existingRunId: string | null;
  stage: string | null;
  outstanding: boolean;
};

type ScanTarget = {
  asset: {
    id: string;
    equipmentCode: string;
    type: string;
    assetSubtype: string | null;
    location: string;
    allottedSerialNo: string | null;
    capacitySpec: string | null;
    status: string;
  };
  options: Option[];
  primaryTemplateCode: string | null;
  // "token" = the current opaque sticker. "legacy" = a pre-reprint label that
  // still resolves only because legacy scanning has not been switched off yet.
  resolvedVia?: "token" | "legacy";
};

// Asset type -> the screen that renders its checklists. Held here rather than
// returned by the API: which URL renders a hydrant sheet is the frontend's
// business, and an API that returns route strings is an API that breaks when a
// route is renamed.
const SCREEN: Record<string, string> = {
  FIRE_EXTINGUISHER: "/fire-safety/fe-inspection",
  FIRE_ALARM_PANEL: "/fire-safety/fire-alarm",
  BEAM_DETECTOR: "/fire-safety/fire-alarm",
  FIRE_HYDRANT_SYSTEM: "/fire-safety/fire-hydrant",
};

const FREQ_LABEL: Record<string, string> = {
  DAILY: "Daily", MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUAL: "Annual",
};

function Shell({ tone, title, children }: { tone: "error" | "plain"; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="mb-3 flex items-center gap-2">
        <QrCode size={16} style={{ color: MX.gold }} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: MX.muted }}>
          Scanned sticker
        </span>
      </div>
      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: tone === "error" ? MX.red : MX.iceLine,
          background: tone === "error" ? MX.redSoft : MX.paper,
        }}
      >
        <h1
          className="text-[17px] font-semibold"
          style={{ color: tone === "error" ? MX.red : MX.navy, fontFamily: DISPLAY_FONT }}
        >
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

export default async function FireAssetScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let target: ScanTarget | null = null;
  let error: string | null = null;
  try {
    target = await backendFetch<ScanTarget>(
      `/api/fire/scan/${encodeURIComponent(token)}/target`,
    );
  } catch (e: any) {
    error = e?.message ?? "That sticker could not be resolved.";
  }

  if (error || !target) {
    return (
      <Shell tone="error" title="This sticker does not resolve">
        <p className="mt-2 text-[13px]" style={{ color: MX.ink }}>
          {error}
        </p>
        <p className="mt-2 text-[12px]" style={{ color: MX.muted }}>
          Most likely this label was replaced during the QR reprint and the old one is no
          longer valid — check the cylinder for a newer sticker. Otherwise the asset may have
          been decommissioned, removed from the register, or belong to a plant you cannot
          access.
        </p>
        <Link
          href="/fire-safety/register"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-white"
          style={{ background: MX.navy }}
        >
          Open the fire register <ArrowRight size={13} />
        </Link>
      </Shell>
    );
  }

  const { asset, options, primaryTemplateCode } = target;
  const screen = SCREEN[asset.type];

  if (!screen || options.length === 0) {
    return (
      <Shell tone="plain" title={asset.equipmentCode}>
        <p className="mt-1 text-[12.5px]" style={{ color: MX.muted }}>
          {asset.location}
        </p>
        <div
          className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]"
          style={{ borderColor: MX.gold, background: MX.amberSoft, color: MX.amber }}
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            No controlled checklist is published for a{" "}
            {asset.type.replace(/_/g, " ").toLowerCase()} yet, so there is nothing to fill in from
            this sticker. An HSE Manager can add one in the Checklist Library.
          </span>
        </div>
        <Link
          href="/fire-safety/register"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-white"
          style={{ background: MX.navy }}
        >
          Open the fire register <ArrowRight size={13} />
        </Link>
      </Shell>
    );
  }

  // The common case — one checklist, so no decision to make. Straight through
  // with the asset pre-selected. `redirect` throws, so nothing below runs.
  //
  // A legacy sticker is NOT allowed to short-circuit: it still works today, but
  // it is about to stop, and the one moment that fact is useful is while someone
  // is standing at the cylinder holding it. Redirecting them silently would mean
  // nobody ever learns which labels still need replacing until they all fail.
  if (options.length === 1 && primaryTemplateCode && target.resolvedVia !== "legacy") {
    redirect(
      `${screen}?asset=${encodeURIComponent(asset.id)}&template=${encodeURIComponent(primaryTemplateCode)}`,
    );
  }

  // Several cadences: ask, rather than guess wrong three times out of four.
  return (
    <Shell tone="plain" title={asset.equipmentCode}>
      <p className="mt-1 text-[12.5px]" style={{ color: MX.muted }}>
        {asset.location}
        {asset.allottedSerialNo ? ` · Tag ${asset.allottedSerialNo}` : ""}
        {asset.assetSubtype ? ` · ${asset.assetSubtype}` : ""}
      </p>
      {target.resolvedVia === "legacy" && (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]"
          style={{ borderColor: MX.gold, background: MX.amberSoft, color: MX.amber }}
          role="status"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            <strong>This label is out of date.</strong> It still works for now, but it will stop
            once the QR reprint is complete. Ask your supervisor for a replacement sticker for
            this unit.
          </span>
        </div>
      )}

      <p className="mt-3 text-[12px]" style={{ color: MX.ink }}>
        {options.length === 1
          ? "Open the checklist for this unit:"
          : `This unit has ${options.length} checklists. Which are you filling in?`}
      </p>

      <div className="mt-2 space-y-1.5">
        {options.map((o) => (
          <Link
            key={o.templateCode}
            href={`${screen}?asset=${encodeURIComponent(asset.id)}&template=${encodeURIComponent(o.templateCode)}`}
            className="flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors hover:border-[#C9A961]"
            style={{
              borderColor: o.outstanding ? MX.gold : MX.iceLine,
              background: o.outstanding ? MX.paper : MX.ice,
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-semibold" style={{ color: MX.navy }}>
                  {FREQ_LABEL[o.frequency] ?? o.frequency}
                </span>
                <span className="text-[10px]" style={{ color: MX.muted }}>
                  {o.periodLabel}
                </span>
                {!o.outstanding && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
                    style={{ background: MX.greenSoft, color: MX.green }}
                  >
                    <CheckCircle2 size={9} /> done
                  </span>
                )}
              </div>
              <div className="truncate text-[11px]" style={{ color: MX.muted }}>
                {o.documentNo ?? o.name}
              </div>
            </div>
            <ArrowRight size={14} style={{ color: MX.navy }} />
          </Link>
        ))}
      </div>
    </Shell>
  );
}
