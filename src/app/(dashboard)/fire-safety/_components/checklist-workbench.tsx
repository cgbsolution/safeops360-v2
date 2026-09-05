"use client";

// The screen behind Fire Alarm, Fire Hydrant and FE Inspection.
//
// All three are the same interaction — pick an asset, pick a frequency tab, fill
// the sheet — so they are one component parameterised by the templates the page
// hands it. Three near-identical screens would be three places for the daily
// grid's save semantics to drift apart.
//
// The frequency tabs come from the seeded templates, not from a hardcoded list.
// That is what makes the Fire Alarm screen show six tabs (Daily, Monthly ×2,
// Quarterly, Annual, Beam Detector) and the Hydrant screen four, without either
// screen knowing how many sheets its workbook has — and what makes the next
// sheet the client sends a template-seed job rather than a frontend change.

import * as React from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import {
  ChecklistAsset,
  ChecklistGrid,
  ChecklistRun,
  DISPLAY_FONT,
  MX,
  TemplateSummary,
  fireFetch,
  todayPeriod,
} from "../lib";
import { ChecklistFormRunner } from "./checklist-form";
import { ChecklistGridRunner } from "./checklist-grid";
import { DocumentHeader } from "./document-header";
import { Card } from "@/components/ui/card";

const FREQ_LABEL: Record<string, string> = {
  DAILY: "Daily",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annually",
};

function tabLabel(t: TemplateSummary): string {
  const base = FREQ_LABEL[t.document.frequency ?? ""] ?? t.document.frequency ?? t.templateCode;
  // The two monthly alarm sheets are the same document number and the same
  // frequency; only the unit tells them apart, so the unit has to be on the tab.
  return t.document.siteVariant ? `${base} · ${t.document.siteVariant.replace(/_/g, "-")}` : base;
}

/** Which template a given asset should use for a frequency the asset has more
 *  than one of. Unit-21 A is a ZONE panel, Unit-21 B is a LOOP panel, and the
 *  panel's own subtype is the fact that decides — not the operator. */
function preferredFor(asset: ChecklistAsset | null, candidates: TemplateSummary[]): TemplateSummary | null {
  if (!candidates.length) return null;
  if (!asset) return candidates[0];
  const sub = (asset.assetSubtype ?? "").toUpperCase();
  const match = candidates.find((t) => {
    const v = (t.document.siteVariant ?? "").toUpperCase();
    if (!v) return false;
    if (sub === "ZONE") return v.endsWith("_A");
    if (sub === "LOOP") return v.endsWith("_B");
    return false;
  });
  return match ?? candidates[0];
}

export function ChecklistWorkbench({
  title,
  description,
  assetTypeLabel,
  assets,
  templates,
  canWrite = true,
  loadError,
  // Set when the screen was reached by scanning an asset's QR sticker. The
  // inspector is standing in front of THAT unit, so opening on the first asset
  // in the list would be actively wrong — they would fill in a sheet for a
  // different cylinder without noticing.
  initialAssetId,
  initialTemplateCode,
}: {
  title: string;
  description: string;
  assetTypeLabel: string;
  assets: ChecklistAsset[];
  templates: TemplateSummary[];
  canWrite?: boolean;
  loadError?: string | null;
  initialAssetId?: string | null;
  initialTemplateCode?: string | null;
}) {
  const [query, setQuery] = React.useState("");
  // Fall back to the first asset only when nothing was requested. A requested id
  // that is not in the list means the sticker points at an asset outside this
  // user's plant scope — handled below rather than silently swapped.
  const requested = initialAssetId && assets.some((a) => a.id === initialAssetId)
    ? initialAssetId
    : null;
  const [assetId, setAssetId] = React.useState<string>(requested ?? assets[0]?.id ?? "");
  const scannedButOutOfScope = Boolean(initialAssetId && !requested);
  const asset = React.useMemo(() => assets.find((a) => a.id === assetId) ?? null, [assets, assetId]);

  // Templates this asset can actually run — an asset picker showing a beam
  // detector next to a "Monthly Hydrant" tab would be offering a 409.
  const applicable = React.useMemo(
    () => templates.filter((t) => !asset || t.document.assetType === asset.type),
    [templates, asset],
  );

  // Group by frequency so the two monthly alarm variants collapse into the one
  // the panel's subtype selects, instead of both showing as separate tabs.
  const tabs = React.useMemo(() => {
    const byFreq = new Map<string, TemplateSummary[]>();
    for (const t of applicable) {
      const f = t.document.frequency ?? "";
      byFreq.set(f, [...(byFreq.get(f) ?? []), t]);
    }
    return [...byFreq.entries()]
      .map(([freq, list]) => ({ freq, template: preferredFor(asset, list)!, alternatives: list }))
      .sort(
        (a, b) =>
          ["DAILY", "MONTHLY", "QUARTERLY", "ANNUAL"].indexOf(a.freq) -
          ["DAILY", "MONTHLY", "QUARTERLY", "ANNUAL"].indexOf(b.freq),
      );
  }, [applicable, asset]);

  const [templateCode, setTemplateCode] = React.useState<string>(initialTemplateCode ?? "");
  React.useEffect(() => {
    // Re-resolve whenever the asset changes: the selected code may belong to a
    // template that does not apply to the new asset at all.
    const stillValid = tabs.some((t) => t.template.templateCode === templateCode);
    if (!stillValid) setTemplateCode(tabs[0]?.template.templateCode ?? "");
  }, [tabs, templateCode]);

  const template = React.useMemo(
    () => applicable.find((t) => t.templateCode === templateCode) ?? null,
    [applicable, templateCode],
  );

  const [grid, setGrid] = React.useState<ChecklistGrid | null>(null);
  const [run, setRun] = React.useState<ChecklistRun | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!asset || !template) {
      setGrid(null);
      setRun(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    setGrid(null);
    setRun(null);

    const isGrid = template.document.layout !== "FORM";
    const url = isGrid
      ? `/api/fire/checklists/grid?templateCode=${encodeURIComponent(template.templateCode)}&assetId=${asset.id}`
      : `/api/fire/checklists/run?templateCode=${encodeURIComponent(template.templateCode)}&assetId=${asset.id}` +
        `&period=${encodeURIComponent(todayPeriod(template.document.frequency))}`;

    fireFetch<any>(url)
      .then((d) => {
        if (cancelled) return;
        if (isGrid) setGrid(d as ChecklistGrid);
        else setRun(d as ChecklistRun);
      })
      .catch((e) => !cancelled && setError(e?.message ?? "Could not open this checklist."))
      .finally(() => !cancelled && setBusy(false));

    return () => {
      cancelled = true;
    };
  }, [asset, template]);

  const filtered = React.useMemo(() => {
    const n = query.trim().toLowerCase();
    if (!n) return assets;
    return assets.filter(
      (a) =>
        a.equipmentCode.toLowerCase().includes(n) ||
        (a.allottedSerialNo ?? "").toLowerCase().includes(n) ||
        a.location.toLowerCase().includes(n),
    );
  }, [assets, query]);

  if (loadError) {
    return (
      <Card className="rounded-xl p-6 text-[13px] shadow-none" style={{ borderColor: MX.red, background: MX.redSoft, color: MX.red }}>
        {loadError}
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* A sticker that resolves to an asset outside this user's plant scope must
          say so. Silently falling back to the first asset in the list would have
          them fill in a sheet for a different cylinder and never know. */}
      {scannedButOutOfScope && (
        <div
          className="rounded-xl border px-4 py-2.5 text-[12px] lg:col-span-2"
          style={{ borderColor: MX.gold, background: MX.amberSoft, color: MX.amber }}
        >
          <strong>That sticker is for an asset you cannot access.</strong> It belongs to another
          plant, or it has been removed from the register. Pick the unit you are standing at from
          the list — do not record against a different one.
        </div>
      )}

      {/* ── asset picker ────────────────────────────────────────────────── */}
      <aside className="rounded-xl border bg-white" style={{ borderColor: MX.iceLine }}>
        <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${MX.iceLine}` }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: MX.muted }}>
            {assetTypeLabel}
          </div>
          <div className="relative mt-1.5">
            <Search size={13} className="absolute left-2 top-2" style={{ color: MX.muted }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Code, tag or location"
              className="w-full rounded-lg border py-1.5 pl-7 pr-2 text-[12px] outline-none"
              style={{ borderColor: MX.iceLine, color: MX.ink }}
            />
          </div>
        </div>
        <div className="max-h-[62vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px]" style={{ color: MX.muted }}>
              {assets.length === 0
                ? `No ${assetTypeLabel.toLowerCase()} in the register yet.`
                : "No match."}
            </div>
          ) : (
            filtered.map((a) => {
              const on = a.id === assetId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAssetId(a.id)}
                  className="block w-full px-3 py-2 text-left transition-colors"
                  style={{
                    background: on ? MX.ice : "transparent",
                    borderLeft: `3px solid ${on ? MX.gold : "transparent"}`,
                  }}
                >
                  <div className="text-[12px] font-semibold" style={{ color: MX.navy }}>
                    {a.allottedSerialNo ? `FE ${a.allottedSerialNo}` : a.equipmentCode}
                  </div>
                  <div className="flex items-center gap-1 text-[11px]" style={{ color: MX.muted }}>
                    <MapPin size={10} />
                    <span className="truncate">{a.location}</span>
                  </div>
                  {a.assetSubtype && (
                    <div className="mt-0.5 text-[10px] font-medium" style={{ color: MX.gold }}>
                      {a.assetSubtype}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── the sheet ───────────────────────────────────────────────────── */}
      <section className="min-w-0">
        {!asset ? (
          <Card className="rounded-xl p-8 text-center text-[13px] shadow-none" style={{ borderColor: MX.iceLine, color: MX.muted }}>
            <div className="text-[15px] font-semibold" style={{ color: MX.navy, fontFamily: DISPLAY_FONT }}>
              {title}
            </div>
            <p className="mx-auto mt-1 max-w-md">{description}</p>
            <p className="mt-3">Register a {assetTypeLabel.toLowerCase().replace(/s$/, "")} to start recording checks.</p>
          </Card>
        ) : (
          <>
            {template && (
              <DocumentHeader
                doc={template.document}
                title={template.name}
                subtitle={`${asset.equipmentCode} · ${asset.location}${
                  asset.assetSubtype ? ` · ${asset.assetSubtype}` : ""
                }`}
              />
            )}

            {tabs.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tabs.map((t) => {
                  const on = t.template.templateCode === templateCode;
                  return (
                    <button
                      key={t.freq + t.template.templateCode}
                      type="button"
                      onClick={() => setTemplateCode(t.template.templateCode)}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors"
                      style={{
                        background: on ? MX.navy : MX.paper,
                        color: on ? "#fff" : MX.navy,
                        border: `1px solid ${on ? MX.navy : MX.iceLine}`,
                      }}
                    >
                      {tabLabel(t.template)}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3">
              {busy && (
                <div className="flex items-center gap-2 py-8 text-[13px]" style={{ color: MX.muted }}>
                  <Loader2 size={15} className="animate-spin" /> Opening the sheet…
                </div>
              )}
              {error && !busy && (
                <div
                  className="rounded-xl border p-4 text-[12.5px]"
                  style={{ borderColor: MX.red, background: MX.redSoft, color: MX.red }}
                >
                  {error}
                </div>
              )}
              {!busy && !error && grid && <ChecklistGridRunner initial={grid} canWrite={canWrite} />}
              {!busy && !error && run && <ChecklistFormRunner initial={run} canWrite={canWrite} />}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
