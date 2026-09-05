// Screen 3 — Site Inventory Ledger (§7 #3), with the operational actions that
// make it usable: receive, issue, adjust, move, transfer, dispose.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { resolvePlantContext } from "@/lib/plant-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Chemical, InventoryItem, StorageLocation } from "@/lib/chemicals/types";
import { daysUntil, fmtDate, fmtQty } from "@/lib/chemicals/types";
import {
  EmptyState, ErrorState, HazardChips, Kpi, StatusChip, SubNav, TableNote,
} from "../_components";
import { NewBatchDialog, RowActions } from "./inventory-actions";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";

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
  let chemicals: Chemical[] = [];
  let error: string | null = null;
  try {
    const [i, l, c] = await Promise.all([
      backendFetch<InventoryItem[]>(`/api/chemicals/inventory?${qs.toString()}`),
      backendFetch<StorageLocation[]>(`/api/chemicals/storage-locations?plantId=${ctx.plantId}`),
      backendFetch<{ items: Chemical[] }>(`/api/chemicals/masters?limit=500`),
    ]);
    items = i; locations = l; chemicals = c.items;
  } catch (e: any) {
    error = e?.message ?? "Failed to load the inventory ledger";
  }

  const expiringSoon = items.filter((i) => {
    const d = daysUntil(i.expiryDate);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const expired = items.filter((i) => i.currentStatus === "EXPIRED").length;
  const low = items.filter((i) => i.currentStatus === "LOW").length;
  const plants = ctx.plants.map((p) => ({ id: p.id, name: p.name, code: p.code }));
  const filtered = !!(sp.storageLocationId || sp.status);

  const newBatch = (
    <NewBatchDialog plantId={ctx.plantId} chemicals={chemicals} locations={locations} />
  );

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
        action={newBatch}
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
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-slate-700">Storage location</Label>
              <SelectField name="storageLocationId" defaultValue={sp.storageLocationId ?? ""} className="w-56"
                placeholder="All locations"
                options={locations.map((l) => ({ value: l.id, label: "{l.name} ({l.code})" }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-slate-700">Status</Label>
              <SelectField name="status" defaultValue={sp.status ?? ""} className="w-40"
                placeholder="All"
                options={[
                { value: "IN_STOCK", label: "In stock" },
                { value: "LOW", label: "Low" },
                { value: "EXPIRED", label: "Expired" },
                { value: "DISPOSED", label: "Disposed" }
              ]}
              />
            </div>
            <Button type="submit" className="mb-0.5">Apply</Button>
            {filtered && (
              <Button asChild variant="ghost" className="mb-0.5">
                <Link href={`/chemicals/inventory?plantId=${ctx.plantId}`}>Clear</Link>
              </Button>
            )}
          </form>

          {items.length === 0 ? (
            <EmptyState
              title={filtered ? "No batches match these filters" : "No stock recorded at this site"}
              hint={
                filtered
                  ? undefined
                  : "Receive the first batch to start the ledger. Quantities are only ever changed by posting a transaction."
              }
              action={!filtered ? newBatch : undefined}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chemical</TableHead>
                      <TableHead>Batch / lot</TableHead>
                      <TableHead>Hazard</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i) => {
                      const d = daysUntil(i.expiryDate);
                      return (
                        <TableRow key={i.id}>
                          <TableCell>
                            <Link href={`/chemicals/${i.chemicalId}`} className="font-medium text-slate-900 hover:underline">
                              {i.chemicalName ?? "—"}
                            </Link>
                            {i.supplierName && <div className="text-[11px] text-slate-400">{i.supplierName}</div>}
                          </TableCell>
                          <TableCell className="text-slate-600">{i.batchLotNumber}</TableCell>
                          <TableCell><HazardChips classes={i.hazardClasses} /></TableCell>
                          <TableCell className="text-slate-600">
                            {i.storageLocationName ?? <span className="text-amber-600">Unassigned</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-slate-800">
                            {fmtQty(i.quantity, i.unit)}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {fmtDate(i.expiryDate)}
                            {d !== null && d >= 0 && d <= 30 && (
                              <span className="ml-1 text-[11px] text-amber-600">({d}d)</span>
                            )}
                          </TableCell>
                          <TableCell><StatusChip status={i.currentStatus} /></TableCell>
                          <TableCell>
                            <RowActions item={i} locations={locations} plants={plants} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TableNote>
                Quantity and status are computed from the ledger by the database and cannot be
                edited directly — including by a script. A physical count that disagrees is
                recorded as an adjustment with a reason, never as a correction.
              </TableNote>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
