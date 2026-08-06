// Screen 3 — Site Inventory Ledger (§7 #3). Per facility, filterable by storage
// location and batch.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { resolvePlantContext } from "@/lib/plant-context";
import type { InventoryItem, StorageLocation } from "@/lib/chemicals/types";
import { fmtDate, fmtQty, daysUntil } from "@/lib/chemicals/types";
import { EmptyState, ErrorState, HazardChips, Kpi, StatusChip, SubNav, TILE } from "../_components";

export const dynamic = "force-dynamic";

export default async function InventoryLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ plantId?: string; storageLocationId?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await resolvePlantContext(sp.plantId);

  if (!ctx.plantId) {
    return (
      <div>
        <PageHeader title="Site Inventory Ledger" breadcrumbs={[{ label: "Chemical & Hazmat", href: "/chemicals" }]} />
        <SubNav current="/chemicals/inventory" />
        <EmptyState title="No site available" hint="You do not have access to a site with chemical inventory." />
      </div>
    );
  }

  const qs = new URLSearchParams({ plantId: ctx.plantId });
  if (sp.storageLocationId) qs.set("storageLocationId", sp.storageLocationId);
  if (sp.status) qs.set("status", sp.status);

  let items: InventoryItem[] = [];
  let locations: StorageLocation[] = [];
  let error: string | null = null;
  try {
    [items, locations] = await Promise.all([
      backendFetch<InventoryItem[]>(`/api/chemicals/inventory?${qs.toString()}`),
      backendFetch<StorageLocation[]>(`/api/chemicals/storage-locations?plantId=${ctx.plantId}`),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the inventory ledger";
  }

  const expiringSoon = items.filter((i) => {
    const d = daysUntil(i.expiryDate);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const expired = items.filter((i) => i.currentStatus === "EXPIRED").length;
  const low = items.filter((i) => i.currentStatus === "LOW").length;

  return (
    <div>
      <PageHeader
        title="Site Inventory Ledger"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Chemical & Hazmat", href: "/chemicals" },
          { label: "Inventory" },
        ]}
        description="Every batch on site, with quantities derived from the transaction ledger. Receipt, issue, transfer and disposal are the only ways a quantity changes."
      />
      <SubNav current="/chemicals/inventory" />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Batches on site" value={items.length} sub="with stock on hand" />
            <Kpi label="Low stock" value={low} tone={low ? "warn" : "good"} />
            <Kpi label="Expiring ≤30 days" value={expiringSoon} tone={expiringSoon ? "warn" : "good"} />
            <Kpi label="Expired" value={expired} tone={expired ? "critical" : "good"} sub="dispose and record a manifest" />
          </div>

          <form className="mb-4 flex flex-wrap items-end gap-2" action="/chemicals/inventory" method="get">
            <input type="hidden" name="plantId" value={ctx.plantId} />
            <div>
              <label className="block text-[11px] font-medium text-slate-500">Storage location</label>
              <select
                name="storageLocationId"
                defaultValue={sp.storageLocationId ?? ""}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">All locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500">Status</label>
              <select
                name="status"
                defaultValue={sp.status ?? ""}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                <option value="IN_STOCK">In stock</option>
                <option value="LOW">Low</option>
                <option value="EXPIRED">Expired</option>
                <option value="DISPOSED">Disposed</option>
              </select>
            </div>
            <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Apply</button>
          </form>

          {items.length === 0 ? (
            <EmptyState title="No batches match these filters" />
          ) : (
            <div className={TILE + " overflow-x-auto p-0"}>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Chemical</th>
                    <th className="px-4 py-2.5 font-semibold">Batch / lot</th>
                    <th className="px-4 py-2.5 font-semibold">Hazard</th>
                    <th className="px-4 py-2.5 font-semibold">Location</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Quantity</th>
                    <th className="px-4 py-2.5 font-semibold">Received</th>
                    <th className="px-4 py-2.5 font-semibold">Expiry</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((i) => {
                    const d = daysUntil(i.expiryDate);
                    return (
                      <tr key={i.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <Link href={`/chemicals/${i.chemicalId}`} className="font-medium text-slate-900 hover:underline">
                            {i.chemicalName ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{i.batchLotNumber}</td>
                        <td className="px-4 py-2.5"><HazardChips classes={i.hazardClasses} /></td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {i.storageLocationName ?? <span className="text-amber-600">Unassigned</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                          {fmtQty(i.quantity, i.unit)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{fmtDate(i.receiptDate)}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {fmtDate(i.expiryDate)}
                          {d !== null && d >= 0 && d <= 30 && (
                            <span className="ml-1 text-[11px] text-amber-600">({d}d)</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5"><StatusChip status={i.currentStatus} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                Quantity and status are computed from the ledger by the database and cannot be edited
                directly — including by a script. A physical count that disagrees is recorded through
                a stock verification, which writes a compensating adjustment rather than a correction.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
