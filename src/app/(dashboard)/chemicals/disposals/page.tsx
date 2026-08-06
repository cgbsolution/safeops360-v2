// Screen 7 — Disposal Register (§7 #7).
//
// The record a Pollution Control Board inspection asks for. Manifest reference
// and vendor are mandatory at the database level, so every row here is
// defensible; what the screen adds is visibility of the EAI Register linkage,
// including where it is MISSING.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { resolvePlantContext } from "@/lib/plant-context";
import type { DisposalRow } from "@/lib/chemicals/types";
import { fmtDate, fmtQty, prettyLabel } from "@/lib/chemicals/types";
import { Chip, EmptyState, ErrorState, Kpi, SubNav, TILE } from "../_components";

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
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
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
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState
              title="No disposals recorded"
              hint="A disposal is posted against a batch and requires a manifest reference and an authorised vendor."
            />
          ) : (
            <div className={TILE + " overflow-x-auto p-0"}>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Chemical</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Quantity</th>
                    <th className="px-4 py-2.5 font-semibold">Manifest</th>
                    <th className="px-4 py-2.5 font-semibold">Vendor</th>
                    <th className="px-4 py-2.5 font-semibold">Waste category</th>
                    <th className="px-4 py-2.5 font-semibold">EAI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{fmtDate(r.disposalDate)}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/chemicals/${r.chemicalId}`} className="font-medium text-slate-900 hover:underline">
                          {r.chemicalName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                        {fmtQty(r.quantity, r.unit)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-slate-700">{r.manifestReference}</div>
                        {r.manifestAttachmentId ? (
                          <a
                            href={`/api/attachments/${r.manifestAttachmentId}/download`}
                            className="text-[11px] text-slate-500 underline"
                          >
                            View scan
                          </a>
                        ) : (
                          <span className="text-[11px] text-amber-600">No scan attached</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {r.disposalVendor}
                        {r.vendorAuthorisationNo && (
                          <div className="text-[11px] text-slate-400">Auth {r.vendorAuthorisationNo}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {r.wasteCategory ?? "—"}
                        {r.disposalMethod && (
                          <div className="text-[11px] text-slate-400">{prettyLabel(r.disposalMethod)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.eaiEntryId ? (
                          <Chip label="Linked" tone="bg-emerald-50 text-emerald-700 border-emerald-200" />
                        ) : (
                          <Chip label="Not linked" tone="bg-amber-50 text-amber-800 border-amber-200" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
