// Screen 2 — Chemical Detail (§7 #2): classification, SDS, linked inventory
// across sites, and the HIRA hazard rows this chemical implies.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { Chemical, InventoryItem } from "@/lib/chemicals/types";
import { fmtDate, fmtQty, prettyLabel } from "@/lib/chemicals/types";
import { ErrorState, HazardChips, StatusChip } from "../_components";
import { EvidenceLink } from "../evidence-link";
import { ChemicalActions } from "./chemical-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Detail = Chemical & { inventory: InventoryItem[]; totalOnHand: number };
type HazardProposals = {
  proposals: {
    hazardId: string;
    hazardCode: string;
    hazardName: string;
    sourceHazardClass: string;
    contextualDescription: string;
    regulationRef: string | null;
    regulationSection: string | null;
  }[];
  missingLibraryHazards: string[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
  );
}

export default async function ChemicalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let c: Detail | null = null;
  let hazards: HazardProposals | null = null;
  let error: string | null = null;
  try {
    c = await backendFetch<Detail>(`/api/chemicals/masters/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load this chemical";
  }
  if (c) {
    // Secondary, non-blocking: a HIRA library that isn't seeded must not stop
    // the detail page rendering.
    try {
      hazards = await backendFetch<HazardProposals>(`/api/chemicals/masters/${id}/hira-hazards`);
    } catch {
      hazards = null;
    }
  }

  if (error || !c) {
    return (
      <div>
        <PageHeader title="Chemical" breadcrumbs={[{ label: "Chemical & Hazmat", href: "/chemicals" }]} />
        <ErrorState message={error ?? "Not found"} />
      </div>
    );
  }

  const nfpa = c.nfpa;
  return (
    <div>
      <PageHeader
        title={c.name}
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Chemical & Hazmat", href: "/chemicals" },
          { label: c.name },
        ]}
        description={c.commonName ?? undefined}
        action={<ChemicalActions chemical={c} />}
      />

      {c.status === "RESTRICTED" && (
        <Alert variant="destructive" size="lg" className="mb-4 rounded-xl p-4">
          <div className="text-sm font-semibold text-rose-800">Restricted chemical</div>
          <div className="mt-0.5 text-xs text-rose-700">
            {c.restrictionReason ?? "No reason recorded."} Receipt requires an HSE Manager exception.
          </div>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── identity + classification ── */}
        <Card className="rounded-xl p-4 shadow-none lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Identity & hazard classification</h2>
            <StatusChip status={c.status} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="CAS number">{c.casNumber ?? "—"}</Field>
            <Field label="UN number">{c.unNumber ?? "—"}</Field>
            <Field label="Physical state">{prettyLabel(c.physicalState)}</Field>
            <Field label="Flash point">
              {c.flashPointCelsius === null ? "—" : `${c.flashPointCelsius} °C`}
            </Field>
            <Field label="Boiling point">
              {c.boilingPointCelsius === null ? "—" : `${c.boilingPointCelsius} °C`}
            </Field>
            <Field label="NFPA 704">
              {nfpa.health === null && nfpa.flammability === null && nfpa.reactivity === null ? (
                "—"
              ) : (
                <span className="tabular-nums">
                  H{nfpa.health ?? "-"} / F{nfpa.flammability ?? "-"} / R{nfpa.reactivity ?? "-"}
                  {nfpa.special ? ` / ${nfpa.special}` : ""}
                </span>
              )}
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Hazard classes"><div className="mt-1"><HazardChips classes={c.hazardClasses} /></div></Field>
          </div>
          {c.regulatoryReference && (
            <div className="mt-4">
              <Field label="Regulatory reference">{c.regulatoryReference}</Field>
            </div>
          )}
          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
            Classification source: <strong>{prettyLabel(c.hazardClassificationSource)}</strong>. These
            values are entered by a person who has read the Safety Data Sheet. The SDS file is
            attached as supporting evidence and is not machine-read — automated extraction of flash
            point, NFPA ratings and hazard phrases is a separate licensed capability and is not part
            of this module.
          </p>
        </Card>

        {/* ── SDS ── */}
        <Card className="rounded-xl p-4 shadow-none">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Safety Data Sheet</h2>
          {!c.sdsAttachmentId ? (
            <Alert variant="warning" size="lg" className="p-3">
              <div className="text-xs font-semibold text-amber-800">No SDS attached</div>
              <div className="mt-1 text-[11px] text-amber-700">
                This chemical cannot be activated until a sheet is attached — enforced as a database
                constraint, not just a form rule.
              </div>
            </Alert>
          ) : (
            <div className="space-y-3">
              <Field label="Revision date">{fmtDate(c.sdsRevisionDate)}</Field>
              <Field label="Review due">
                {c.sdsReviewOverdue ? (
                  <span className="font-medium text-rose-600">
                    Overdue since {fmtDate(c.sdsReviewDueDate)}
                  </span>
                ) : (
                  fmtDate(c.sdsReviewDueDate)
                )}
              </Field>
              <EvidenceLink
                entityType="chemical_master"
                entityId={c.id}
                attachmentId={c.sdsAttachmentId}
                label="View SDS document"
              />
              {c.sdsReviewOverdue && (
                <p className="text-[11px] text-slate-500">
                  An overdue review is a compliance signal, not a stop: the chemical stays usable and
                  stock can still move. Deactivating on a paperwork lapse alone would halt production.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── inventory across sites ── */}
      <Card className="mt-4 overflow-x-auto rounded-xl shadow-none">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Inventory across sites</h2>
          <span className="text-xs text-slate-500">
            Total on hand <strong className="tabular-nums">{fmtQty(c.totalOnHand)}</strong>
          </span>
        </div>
        {c.inventory.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No stock on hand.</div>
        ) : (
          <Table className="w-full text-sm">
            <TableHeader className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <TableRow>
                <TableHead className="px-4 py-2.5 font-semibold">Batch / lot</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Storage location</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Quantity</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Expiry</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Supplier</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {c.inventory.map((i) => (
                <TableRow key={i.id} className="hover:bg-slate-50">
                  <TableCell className="px-4 py-2.5 font-medium text-slate-800">{i.batchLotNumber}</TableCell>
                  <TableCell className="px-4 py-2.5 text-slate-600">{i.storageLocationName ?? "Unassigned"}</TableCell>
                  <TableCell className="px-4 py-2.5 tabular-nums text-slate-800">{fmtQty(i.quantity, i.unit)}</TableCell>
                  <TableCell className="px-4 py-2.5 text-slate-600">{fmtDate(i.expiryDate)}</TableCell>
                  <TableCell className="px-4 py-2.5 text-slate-600">{i.supplierName ?? "—"}</TableCell>
                  <TableCell className="px-4 py-2.5"><StatusChip status={i.currentStatus} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          Quantities are derived from the transaction ledger. There is no editable quantity field —
          a correction is a compensating adjustment, recorded with a reason.
        </div>
      </Card>

      {/* ── HIRA linkage ── */}
      {hazards && (
        <Card className="mt-4 rounded-xl p-4 shadow-none">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">HIRA hazard rows implied</h2>
          <p className="mb-3 text-[11px] text-slate-500">
            These rows can be added to a HIRA entry that is being authored, carrying this chemical's
            regulatory citation to hazard-row grain. Approved entries are not modified.
          </p>
          {hazards.missingLibraryHazards.length > 0 && (
            <Alert variant="warning" className="mb-3 p-2.5 text-[11px]">
              The hazard library is missing {hazards.missingLibraryHazards.join(", ")} — rows for
              those classes cannot be generated until the HIRA master seed is re-run.
            </Alert>
          )}
          {hazards.proposals.length === 0 ? (
            <div className="text-sm text-slate-400">No mapped hazard rows.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {hazards.proposals.map((p) => (
                <li key={p.hazardCode} className="py-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-800">{p.hazardName}</span>
                    <code className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">{p.hazardCode}</code>
                    {p.regulationRef && (
                      <span className="text-[11px] text-slate-500">
                        {p.regulationRef}
                        {p.regulationSection ? ` ${p.regulationSection}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">{p.contextualDescription}</div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/hira" className="mt-3 inline-block text-xs font-medium text-slate-700 hover:underline">
            Open HIRA →
          </Link>
        </Card>
      )}
    </div>
  );
}
