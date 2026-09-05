// Screen 7 — Disposal Register (§7 #7).
//
// The record a Pollution Control Board inspection asks for. Manifest reference
// and vendor are mandatory at the database level, so every row here is
// defensible; what the screen adds is visibility of the EAI Register linkage,
// including where it is MISSING.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { resolvePlantContext } from "@/lib/plant-context";
import type { DisposalRow } from "@/lib/chemicals/types";
import { fmtDate, fmtQty, prettyLabel } from "@/lib/chemicals/types";
import { EmptyState, ErrorState, Kpi, SubNav } from "../_components";
import { EvidenceLink } from "../evidence-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DisposalRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await resolvePlantContext(sp.plantId);

  let rows: DisposalRow[] = [];
  let error: string | null = null;
  try {
    rows = await backendFetch<DisposalRow[]>(
      `/api/chemicals/disposals${ctx.plantId ? `?plantId=${ctx.plantId}` : ""}`
    );
  } catch (e: any) {
    error = e?.message ?? "Failed to load the disposal register";
  }

  const unlinked = rows.filter((r) => !r.eaiEntryId).length;
  const noManifestScan = rows.filter((r) => !r.manifestAttachmentId).length;

  return (
    <div>
      <PageHeader
        title="Disposal Register"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Chemical & Hazmat", href: "/chemicals" },
          { label: "Disposals" },
        ]}
        description="Hazardous-waste disposals with the manifest and authorised vendor behind each one. Disposal quantities flow to the EAI Register as environmental aspect data."
      />
      <SubNav current="/chemicals/disposals" />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Disposals recorded" value={rows.length} />
            <Kpi
              label="Not in EAI Register"
              value={unlinked}
              tone={unlinked ? "warn" : "good"}
              sub="no covering aspect entry"
            />
            <Kpi
              label="Manifest not scanned"
              value={noManifestScan}
              tone={noManifestScan ? "warn" : "good"}
              sub="reference held, file missing"
            />
            <Kpi
              label="Vendors used"
              value={new Set(rows.map((r) => r.disposalVendor)).size}
            />
          </div>

          {unlinked > 0 && (
            <Alert variant="warning" size="lg" className="mb-4 rounded-xl p-4">
              <div className="text-sm font-semibold text-amber-800">
                {unlinked} disposal{unlinked === 1 ? " is" : "s are"} not represented in the EAI Register
              </div>
              <div className="mt-1 text-xs text-amber-700">
                No approved environmental aspect entry at this site covers hazardous-waste disposal,
                so there is nothing to attach the quantity to. The platform deliberately does not
                create the entry itself: an aspect entry needs a competent person&apos;s likelihood
                and magnitude assessment against the impact matrix, and a machine-invented score in
                the register an ISO 14001 auditor reads is worse than a visible gap.
              </div>
              <Link href="/eai" className="mt-2 inline-block text-xs font-medium text-amber-800 underline">
                Open the EAI Register →
              </Link>
            </Alert>
          )}

          {rows.length === 0 ? (
            <EmptyState
              title="No disposals recorded"
              hint="A disposal is posted against a batch and requires a manifest reference and an authorised vendor."
            />
          ) : (
            <Card className="overflow-x-auto rounded-xl shadow-none">
              <Table className="w-full text-sm">
                <TableHeader className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableRow>
                    <TableHead className="px-4 py-2.5 font-semibold">Date</TableHead>
                    <TableHead className="px-4 py-2.5 font-semibold">Chemical</TableHead>
                    <TableHead className="px-4 py-2.5 text-right font-semibold">Quantity</TableHead>
                    <TableHead className="px-4 py-2.5 font-semibold">Manifest</TableHead>
                    <TableHead className="px-4 py-2.5 font-semibold">Vendor</TableHead>
                    <TableHead className="px-4 py-2.5 font-semibold">Waste category</TableHead>
                    <TableHead className="px-4 py-2.5 font-semibold">EAI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-slate-50">
                      <TableCell className="whitespace-nowrap px-4 py-2.5 text-slate-600">{fmtDate(r.disposalDate)}</TableCell>
                      <TableCell className="px-4 py-2.5">
                        <Link href={`/chemicals/${r.chemicalId}`} className="font-medium text-slate-900 hover:underline">
                          {r.chemicalName}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                        {fmtQty(r.quantity, r.unit)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <div className="text-slate-700">{r.manifestReference}</div>
                        {r.manifestAttachmentId ? (
                          <EvidenceLink
                            entityType="chemical_disposal"
                            entityId={r.id}
                            attachmentId={r.manifestAttachmentId}
                            label="View scan"
                            className="text-[11px] text-slate-500 underline"
                          />
                        ) : (
                          <span className="text-[11px] text-amber-600">No scan attached</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-slate-700">
                        {r.disposalVendor}
                        {r.vendorAuthorisationNo && (
                          <div className="text-[11px] text-slate-400">Auth {r.vendorAuthorisationNo}</div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-slate-600">
                        {r.wasteCategory ?? "—"}
                        {r.disposalMethod && (
                          <div className="text-[11px] text-slate-400">{prettyLabel(r.disposalMethod)}</div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        {r.eaiEntryId ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Linked</Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-200">Not linked</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
