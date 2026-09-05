// Screen 4 — Storage Location Map (§7 #4).
//
// The requirement is that incompatibility is "surfaced visually, not just on
// save". So each location card computes the co-storage conflicts among the
// items ALREADY in it and shows them on the card — a store manager should be
// able to see the problem standing in front of the shelf, not discover it when
// a save is rejected.
//
// The matrix is fetched once and evaluated here rather than round-tripping the
// preview endpoint per pair: on a site with a dozen locations that would be
// dozens of requests to render one page.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { resolvePlantContext } from "@/lib/plant-context";
import type { StorageLocation } from "@/lib/chemicals/types";
import { fmtQty, prettyLabel } from "@/lib/chemicals/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, HazardChips, Kpi, SubNav, TableNote } from "../_components";
import { NewStorageLocationDialog } from "./storage-actions";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

type IncompatRule = {
  id: string;
  hazardClassA: string | null;
  hazardClassB: string | null;
  chemicalIdA: string | null;
  chemicalIdB: string | null;
  severity: "BLOCK" | "WARN";
  regulatoryReference: string | null;
  rationale: string | null;
  isActive: boolean;
};

type Override = {
  id: string;
  storageLocationId: string;
  inventoryItemId: string;
  severity: string;
  overrideReason: string;
  overriddenAt: string;
  reviewedAt: string | null;
};

type Conflict = { severity: "BLOCK" | "WARN"; a: string; b: string; ref: string | null };

/** Mirror of the server-side matcher in app/services/chemical_incompatibility.py.
 *  Most-specific rule wins: a named chemical pair overrides a class pair. */
function conflictsIn(loc: StorageLocation, rules: IncompatRule[]): Conflict[] {
  const active = rules.filter((r) => r.isActive);
  const ordered = [...active].sort(
    (x, y) => (x.chemicalIdA && x.chemicalIdB ? 0 : 1) - (y.chemicalIdA && y.chemicalIdB ? 0 : 1)
  );
  const out: Conflict[] = [];
  const seen = new Set<string>();

  const stocked = loc.items.filter((i) => i.quantity > 0);
  for (let i = 0; i < stocked.length; i++) {
    for (let j = i + 1; j < stocked.length; j++) {
      const A = stocked[i];
      const B = stocked[j];
      if (A.chemicalId === B.chemicalId) continue;
      const key = [A.chemicalId, B.chemicalId].sort().join("|");
      if (seen.has(key)) continue;

      for (const r of ordered) {
        let hit = false;
        if (r.chemicalIdA && r.chemicalIdB) {
          hit =
            (r.chemicalIdA === A.chemicalId && r.chemicalIdB === B.chemicalId) ||
            (r.chemicalIdA === B.chemicalId && r.chemicalIdB === A.chemicalId);
        } else if (r.hazardClassA && r.hazardClassB) {
          hit =
            (A.hazardClasses.includes(r.hazardClassA) && B.hazardClasses.includes(r.hazardClassB)) ||
            (A.hazardClasses.includes(r.hazardClassB) && B.hazardClasses.includes(r.hazardClassA));
        }
        if (hit) {
          seen.add(key);
          out.push({
            severity: r.severity,
            a: A.chemicalName ?? "—",
            b: B.chemicalName ?? "—",
            ref: r.regulatoryReference,
          });
          break; // most specific rule for this pair has spoken
        }
      }
    }
  }
  return out.sort((a, b) => (a.severity === "BLOCK" ? -1 : 1) - (b.severity === "BLOCK" ? -1 : 1));
}

export default async function StorageMapPage({
  searchParams,
}: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await resolvePlantContext(sp.plantId);

  if (!ctx.plantId) {
    return (
      <div>
        <PageHeader title="Storage Locations" breadcrumbs={[{ label: "Chemical & Hazmat", href: "/chemicals" }]} />
        <SubNav current="/chemicals/storage" />
        <EmptyState title="No site available" />
      </div>
    );
  }

  let locations: StorageLocation[] = [];
  let rules: IncompatRule[] = [];
  let overrides: Override[] = [];
  let zones: { id: string; zoneCode: string; name: string }[] = [];
  let error: string | null = null;
  try {
    [locations, rules, overrides] = await Promise.all([
      backendFetch<StorageLocation[]>(`/api/chemicals/storage-locations?plantId=${ctx.plantId}`),
      backendFetch<IncompatRule[]>("/api/chemicals/incompatibility"),
      backendFetch<Override[]>(`/api/chemicals/storage-overrides?plantId=${ctx.plantId}&pendingOnly=true`),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load storage locations";
  }
  // Fire zones are a nice-to-have for the create dialog: the Fire module may be
  // unlicensed for this tenant, and a storage location without a zone link is
  // still perfectly valid. Never let it break the page.
  try {
    const z = await backendFetch<{ items?: any[] } | any[]>("/api/fire/zones");
    const list = Array.isArray(z) ? z : (z.items ?? []);
    zones = list.map((r: any) => ({ id: r.id, zoneCode: r.zoneCode, name: r.name }));
  } catch {
    zones = [];
  }

  const perLocation = locations.map((l) => ({ loc: l, conflicts: conflictsIn(l, rules) }));
  const blockCount = perLocation.reduce(
    (n, x) => n + x.conflicts.filter((c) => c.severity === "BLOCK").length, 0
  );
  const warnCount = perLocation.reduce(
    (n, x) => n + x.conflicts.filter((c) => c.severity === "WARN").length, 0
  );

  return (
    <div>
      <PageHeader
        title="Storage Locations & Compatibility"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Chemical & Hazmat", href: "/chemicals" },
          { label: "Storage" },
        ]}
        description="Chemical stores hang off the Fire & Life Safety zone model — one location hierarchy, so a co-storage rule and a fire zone describe the same physical space."
        action={<NewStorageLocationDialog plantId={ctx.plantId} zones={zones} />}
      />
      <SubNav current="/chemicals/storage" />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Storage locations" value={locations.length} />
            <Kpi
              label="Blocking conflicts"
              value={blockCount}
              tone={blockCount ? "critical" : "good"}
              sub={blockCount ? "should be impossible — investigate" : "none"}
            />
            <Kpi label="Warning conflicts" value={warnCount} tone={warnCount ? "warn" : "good"} />
            <Kpi
              label="Overrides pending review"
              value={overrides.length}
              tone={overrides.length ? "warn" : "good"}
              sub="accepted risk without an owner"
            />
          </div>

          {blockCount > 0 && (
            <Alert variant="destructive" size="lg" className="mb-4 rounded-xl p-4">
              <div className="text-sm font-semibold text-rose-800">
                {blockCount} blocking co-storage conflict{blockCount === 1 ? "" : "s"} present
              </div>
              <div className="mt-1 text-xs text-rose-700">
                A BLOCK-severity pair is rejected by a database constraint at save time, so these
                should not be able to exist. Their presence means stock predates the rule or the rule
                was tightened afterwards — either way, segregate them and check the incompatibility
                matrix for a recent change.
              </div>
            </Alert>
          )}

          {locations.length === 0 ? (
            <EmptyState
              title="No storage locations defined for this site"
              hint="Create a location against a Fire & Life Safety zone to start assigning batches."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {perLocation.map(({ loc, conflicts }) => {
                const blocks = conflicts.filter((c) => c.severity === "BLOCK");
                const warns = conflicts.filter((c) => c.severity === "WARN");
                const pct =
                  loc.maxCapacity && loc.maxCapacity > 0
                    ? Math.round((100 * loc.currentOccupancy) / loc.maxCapacity)
                    : null;
                const border =
                  blocks.length ? "border-rose-300" : warns.length ? "border-amber-300" : "border-slate-200";
                return (
                  <div key={loc.id} className={`rounded-xl border ${border} bg-white p-4`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{loc.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {loc.code} · {prettyLabel(loc.storageType)}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {loc.ventilated && <Badge className="bg-sky-50 text-sky-700 border-sky-200">Ventilated</Badge>}
                        {loc.bunded && <Badge className="bg-lime-50 text-lime-700 border-lime-200">Bunded</Badge>}
                        {loc.temperatureControlled && (
                          <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200">Temp-controlled</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-600">
                      Occupancy{" "}
                      <strong className="tabular-nums">
                        {fmtQty(loc.currentOccupancy, loc.capacityUnit)}
                      </strong>
                      {loc.maxCapacity ? (
                        <>
                          {" "}of {fmtQty(loc.maxCapacity, loc.capacityUnit)}
                          {pct !== null && (
                            <span className={pct >= 90 ? " font-semibold text-rose-600" : " text-slate-400"}>
                              {" "}({pct}%)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400"> · no capacity recorded</span>
                      )}
                    </div>

                    {conflicts.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {blocks.map((c, n) => (
                          <div key={`b${n}`} className="rounded-lg border border-rose-200 bg-rose-50 p-2">
                            <div className="text-[11px] font-semibold text-rose-800">
                              BLOCK — {c.a} with {c.b}
                            </div>
                            {c.ref && <div className="text-[10px] text-rose-600">{c.ref}</div>}
                          </div>
                        ))}
                        {warns.map((c, n) => (
                          <div key={`w${n}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                            <div className="text-[11px] font-semibold text-amber-800">
                              WARN — {c.a} with {c.b}
                            </div>
                            {c.ref && <div className="text-[10px] text-amber-700">{c.ref}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 border-t border-slate-100 pt-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {loc.itemCount} batch{loc.itemCount === 1 ? "" : "es"}
                      </div>
                      <ul className="mt-1 space-y-1">
                        {loc.items.slice(0, 6).map((i) => (
                          <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                            <Link href={`/chemicals/${i.chemicalId}`} className="truncate text-slate-700 hover:underline">
                              {i.chemicalName}
                            </Link>
                            <span className="shrink-0 tabular-nums text-slate-500">
                              {fmtQty(i.quantity, i.unit)}
                            </span>
                          </li>
                        ))}
                        {loc.items.length > 6 && (
                          <li className="text-[11px] text-slate-400">+{loc.items.length - 6} more</li>
                        )}
                      </ul>
                      {loc.items.length > 0 && (
                        <div className="mt-2">
                          <HazardChips
                            classes={Array.from(new Set(loc.items.flatMap((i) => i.hazardClasses)))}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {overrides.length > 0 && (
            <Card className="mt-5 overflow-x-auto rounded-xl shadow-none">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Co-storage overrides pending review</h2>
                <p className="text-[11px] text-slate-500">
                  A warning someone accepted with a documented reason. Until reviewed, it is an
                  accepted risk with no owner.
                </p>
              </div>
              <Table className="w-full text-sm">
                <TableHeader className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableRow>
                    <TableHead className="px-4 py-2.5 font-semibold">Raised</TableHead>
                    <TableHead className="px-4 py-2.5 font-semibold">Severity</TableHead>
                    <TableHead className="px-4 py-2.5 font-semibold">Reason given</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {overrides.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="px-4 py-2.5 text-slate-600">
                        {new Date(o.overriddenAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <Badge className="bg-amber-50 text-amber-800 border-amber-200">{o.severity}</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-slate-700">{o.overrideReason || "—"}</TableCell>
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
