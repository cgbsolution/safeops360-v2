"use client";

// The "All fire assets" tab of the consolidated register.
//
// Covers the asset types the PIL/EHSD/CL/028 sheet does not: panels, hydrants,
// hose reels, detectors, emergency lights. Extinguishers are excluded here on
// purpose — they have their own controlled sixteen-column view on the other tab,
// and listing them twice on one screen is the duplication this consolidation
// exists to remove.
//
// Add and edit reuse the dialogs the old /fire-safety/equipment list used
// (NewEquipmentDialog, RowActions) rather than new ones — that list is gone, and
// re-implementing its forms here would recreate exactly the two-paths-onto-one-
// table problem this consolidation exists to remove. Everything else about an
// asset (status override, out-of-service, frequency override, inspection history)
// stays on the asset detail page, which this only links to.

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, QrCode, Search } from "lucide-react";
import { MX, fmtDate } from "../lib";
import { ExportButtons } from "../_components/export-buttons";
import { QrStickerDialog, QrTarget } from "../_components/qr-sticker-dialog";
import { NewEquipmentDialog } from "../equipment/new-equipment";
import { RowActions } from "../equipment/row-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SelectField } from "@/components/ui/select-field";
import { Card } from "@/components/ui/card";

export type FireAsset = {
  id: string;
  equipmentCode: string;
  type: string;
  assetSubtype: string | null;
  location: string;
  buildingId: string | null;
  status: string;
  capacitySpec: string | null;
  lastInspectionDate: string | null;
  nextInspectionDueDate: string | null;
  plantId: string;
  // Needed by the edit dialog so it opens pre-filled instead of blanking fields
  // the operator never touched. All returned by GET /api/fire/equipment.
  zoneId?: string | null;
  make?: string | null;
  model?: string | null;
  serialNo?: string | null;
  maintenanceContractor?: string | null;
};

// Same three inks the register badges and the PDF use, so "amber" means one
// thing across the module.
const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: MX.greenSoft, fg: MX.green },
  DUE_INSPECTION: { bg: MX.amberSoft, fg: MX.amber },
  OVERDUE: { bg: MX.redSoft, fg: MX.red },
  NON_COMPLIANT: { bg: MX.redSoft, fg: MX.red },
  OUT_OF_SERVICE: { bg: MX.ice, fg: MX.muted },
  DECOMMISSIONED: { bg: MX.ice, fg: MX.muted },
};

const STATUSES = ["ACTIVE", "DUE_INSPECTION", "OVERDUE", "NON_COMPLIANT", "OUT_OF_SERVICE"];

type Plant = { id: string; code: string; name: string };
type Zone = { id: string; zoneCode: string; name: string; plantId: string };

export function AssetTable({
  assets,
  plants = [],
  zones = [],
  canWrite,
  canExport = true,
}: {
  assets: FireAsset[];
  plants?: Plant[];
  zones?: Zone[];
  canWrite?: boolean;
  canExport?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [qrFor, setQrFor] = React.useState<QrTarget | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [type, setType] = React.useState<string | null>(null);

  const types = React.useMemo(
    () => [...new Set(assets.map((a) => a.type))].sort(),
    [assets],
  );

  const rows = React.useMemo(() => {
    const n = query.trim().toLowerCase();
    return assets
      .filter((a) => (!status || a.status === status) && (!type || a.type === type))
      .filter(
        (a) =>
          !n ||
          a.equipmentCode.toLowerCase().includes(n) ||
          a.location.toLowerCase().includes(n) ||
          a.type.toLowerCase().includes(n),
      )
      .sort((a, b) => a.location.localeCompare(b.location) || a.equipmentCode.localeCompare(b.equipmentCode));
  }, [assets, query, status, type]);

  const counts = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of assets) out[a.status] = (out[a.status] ?? 0) + 1;
    return out;
  }, [assets]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {STATUSES.filter((s) => counts[s]).map((s) => {
          const st = STATUS_STYLE[s] ?? { bg: MX.ice, fg: MX.muted };
          const on = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(on ? null : s)}
              className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
              style={{ background: st.bg, color: st.fg, border: `1.5px solid ${on ? st.fg : "transparent"}` }}
            >
              {s.replace(/_/g, " ")} · {counts[s]}
            </button>
          );
        })}

        <SelectField
          value={type ?? ""}
          onChange={(v) => setType(v || null)}
          ariaLabel="Filter by asset type"
          placeholder="All types"
          className="h-auto rounded-lg px-2 py-1.5 text-[12px]"
          style={{ borderColor: MX.iceLine, color: MX.ink }}
          options={types.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
        />

        <div className="relative">
          <Search size={13} className="absolute left-2 top-2.5" style={{ color: MX.muted }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Code, type or location"
            className="rounded-lg border py-1.5 pl-7 pr-2 text-[12px] outline-none"
            style={{ borderColor: MX.iceLine, color: MX.ink, minWidth: 210 }}
          />
        </div>

        <span className="text-[11.5px]" style={{ color: MX.muted }}>
          {rows.length} of {assets.length}
        </span>

        {/* This tab had no export at all — the one view of the fire asset master
            an engineer could not take off the screen. Exports the full tab, not
            the current filter: a register handed on is the register, and a
            silently filtered export is how a partial list gets read as complete. */}
        <div className="ml-auto flex items-center gap-2">
          {/* The realistic flow is not "print one sticker" — it is registering a
              batch of assets and wanting one sheet to cut and apply. 24 labels
              per A4 page on Avery L7160 pitch. */}
          {canExport && assets.length > 0 && (
            <a
              href="/api/fire/assets/qr-sheet.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium"
              style={{ borderColor: MX.iceLine, color: MX.navy }}
              title="Printable sheet of QR labels for every fire asset in scope"
            >
              <QrCode size={13} /> QR labels
            </a>
          )}
          <ExportButtons
            pdfHref="/api/fire/equipment/export.pdf"
            xlsxHref="/api/fire/equipment/export.xlsx"
            allowed={canExport}
          />
          <NewEquipmentDialog plants={plants} allowed={canWrite} />
        </div>
      </div>

      <Card className="overflow-x-auto rounded-xl shadow-none" style={{ borderColor: MX.iceLine }}>
        <Table className="w-full min-w-[860px] border-collapse text-[12px]">
          <TableHeader>
            <TableRow style={{ background: MX.ice }}>
              {["Code", "Type", "Subtype", "Location", "Capacity", "Last inspected", "Next due", "Status", ""].map((h) => (
                <TableHead
                  key={h}
                  className="whitespace-nowrap border-b px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: MX.iceLine, color: MX.navy }}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="px-3 py-10 text-center text-[13px]" style={{ color: MX.muted }}>
                  No asset matches this filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a) => {
                const st = STATUS_STYLE[a.status] ?? { bg: MX.ice, fg: MX.muted };
                return (
                  <TableRow key={a.id} className="hover:bg-slate-50/70">
                    <TableCell className="border-b px-2.5 py-1.5 font-semibold" style={{ borderColor: MX.iceLine }}>
                      <Link href={`/fire-safety/equipment/${a.id}`} style={{ color: MX.navy }} className="hover:underline">
                        {a.equipmentCode}
                      </Link>
                    </TableCell>
                    <TableCell className="border-b px-2.5 py-1.5" style={{ borderColor: MX.iceLine }}>
                      {a.type.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="border-b px-2.5 py-1.5" style={{ borderColor: MX.iceLine, color: MX.muted }}>
                      {a.assetSubtype ?? "—"}
                    </TableCell>
                    <TableCell className="border-b px-2.5 py-1.5" style={{ borderColor: MX.iceLine }}>
                      {a.location}
                    </TableCell>
                    <TableCell className="border-b px-2.5 py-1.5" style={{ borderColor: MX.iceLine, color: MX.muted }}>
                      {a.capacitySpec ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap border-b px-2.5 py-1.5" style={{ borderColor: MX.iceLine, color: MX.muted }}>
                      {fmtDate(a.lastInspectionDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap border-b px-2.5 py-1.5 tabular-nums" style={{ borderColor: MX.iceLine }}>
                      {fmtDate(a.nextInspectionDueDate)}
                    </TableCell>
                    <TableCell className="border-b px-2.5 py-1.5" style={{ borderColor: MX.iceLine }}>
                      <span
                        className="inline-block rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: st.bg, color: st.fg }}
                      >
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="border-b px-2.5 py-1.5" style={{ borderColor: MX.iceLine }}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setQrFor({
                              id: a.id,
                              equipmentCode: a.equipmentCode,
                              location: a.location,
                              type: a.type,
                            })
                          }
                          className="rounded p-1 hover:bg-slate-100"
                          title="QR sticker — print and apply to this asset"
                          aria-label={`QR sticker for ${a.equipmentCode}`}
                        >
                          <QrCode size={12} style={{ color: MX.navy }} />
                        </button>
                        <Link
                          href={`/fire-safety/equipment/${a.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline"
                          style={{ color: MX.navy }}
                        >
                          Detail <ArrowUpRight size={11} />
                        </Link>
                        {/* Zones are plant-scoped: offering another site's zone
                            is offering a guaranteed 400 from the backend. */}
                        <RowActions
                          row={{
                            id: a.id,
                            equipmentCode: a.equipmentCode,
                            type: a.type,
                            assetSubtype: a.assetSubtype,
                            location: a.location,
                            zoneId: a.zoneId ?? null,
                            status: a.status,
                            make: a.make ?? null,
                            model: a.model ?? null,
                            serialNo: a.serialNo ?? null,
                            capacitySpec: a.capacitySpec,
                            maintenanceContractor: a.maintenanceContractor ?? null,
                          }}
                          zones={zones.filter((z) => z.plantId === a.plantId)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <QrStickerDialog target={qrFor} onClose={() => setQrFor(null)} />

      <p className="mt-2 text-[11px]" style={{ color: MX.muted }}>
        Status is computed nightly from each asset&rsquo;s inspection due date. Overrides, out-of-service and
        frequency changes live on the asset detail page.
      </p>
    </div>
  );
}
