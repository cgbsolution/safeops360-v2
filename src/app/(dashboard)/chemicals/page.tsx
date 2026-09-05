// Screen 1 — Chemical Master Register (§7 #1), with the module KPI row on top.
//
// Searchable by CAS / hazard class / status, plus the SDS-overdue filter the
// Daily Brief card and the Command Centre widget deep-link into.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Chemical, ChemicalDashboard } from "@/lib/chemicals/types";
import { daysUntil, fmtDate } from "@/lib/chemicals/types";
import {
  EmptyState, ErrorState, HazardChips, Kpi, StatusChip, SubNav, TableNote,
} from "./_components";
import { NewChemicalDialog } from "./new-chemical-dialog";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";

export const dynamic = "force-dynamic";

type ListResponse = { total: number; items: Chemical[]; hazardClasses: string[] };

export default async function ChemicalRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hazardClass?: string; status?: string; sdsOverdue?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.hazardClass) qs.set("hazardClass", sp.hazardClass);
  if (sp.status) qs.set("status", sp.status);
  if (sp.sdsOverdue) qs.set("sdsOverdue", "true");

  let data: ListResponse | null = null;
  let dash: ChemicalDashboard | null = null;
  let error: string | null = null;
  try {
    [data, dash] = await Promise.all([
      backendFetch<ListResponse>(`/api/chemicals/masters?${qs.toString()}`),
      backendFetch<ChemicalDashboard>("/api/chemicals/dashboard"),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the chemical register";
  }

  const hazardOptions = data?.hazardClasses ?? [];
  const filtered = !!(sp.q || sp.hazardClass || sp.status || sp.sdsOverdue);

  return (
    <div>
      <PageHeader
        title="Chemical & Hazmat Management"
        breadcrumbs={[{ label: "Operational Safety" }, { label: "Chemical & Hazmat" }]}
        description="Chemical master data, site inventory ledger, storage compatibility and regulatory threshold tracking — with an automatic MOC when a site crosses a statutory limit."
        action={<NewChemicalDialog hazardClasses={hazardOptions} />}
      />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <>
          {dash && (
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Thresholds breached" value={dash.thresholds.breached}
                tone={dash.thresholds.breached ? "critical" : "good"}
                sub="statutory obligation engaged" href="/chemicals/thresholds" />
              <Kpi label="Approaching" value={dash.thresholds.approaching}
                tone={dash.thresholds.approaching ? "warn" : "good"}
                sub="still avoidable" href="/chemicals/thresholds" />
              <Kpi label="Failed MOC triggers" value={dash.failedTriggers.count}
                tone={dash.failedTriggers.count ? "critical" : "good"}
                sub="unacknowledged" href="/chemicals/trigger-log?status=FAILED" />
              <Kpi label="SDS review overdue" value={dash.sdsOverdue.count}
                tone={dash.sdsOverdue.count ? "warn" : "good"}
                sub="chemical stays usable" href="/chemicals?sdsOverdue=1" />
              <Kpi label="Co-storage overrides" value={dash.pendingStorageOverrides}
                tone={dash.pendingStorageOverrides ? "warn" : "good"}
                sub="awaiting review" href="/chemicals/storage" />
            </div>
          )}

          <SubNav current="/chemicals" />

          {/* A plain GET form — no client JS needed for a list filter, and it
              keeps the URL shareable, which is what the brief cards link into. */}
          <form className="mb-4 flex flex-wrap items-end gap-2" action="/chemicals" method="get">
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-slate-700">Search</Label>
              <Input name="q" defaultValue={sp.q ?? ""} placeholder="Name, CAS or UN number" className="w-64" />
            </div>
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-slate-700">Hazard class</Label>
              <SelectField name="hazardClass" defaultValue={sp.hazardClass ?? ""} className="w-48"
                placeholder="All"
                options={hazardOptions.map((h) => ({ value: h, label: h.replace(/_/g, " ") }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-slate-700">Status</Label>
              <SelectField name="status" defaultValue={sp.status ?? ""} className="w-40"
                placeholder="All"
                options={[
                { value: "ACTIVE", label: "Active" },
                { value: "PENDING_SDS", label: "Pending SDS" },
                { value: "RESTRICTED", label: "Restricted" },
                { value: "INACTIVE", label: "Inactive" }
              ]}
              />
            </div>
            <Label className="flex items-center gap-1.5 pb-2.5 text-xs text-slate-600">
              <Checkbox name="sdsOverdue" value="1" defaultChecked={!!sp.sdsOverdue} />
              SDS review overdue only
            </Label>
            <Button type="submit" className="mb-0.5">Apply</Button>
            {filtered && (
              <Button asChild variant="ghost" className="mb-0.5">
                <Link href="/chemicals">Clear</Link>
              </Button>
            )}
          </form>

          {!data || data.items.length === 0 ? (
            <EmptyState
              title={filtered ? "No chemicals match these filters" : "No chemicals in the register yet"}
              hint={
                filtered
                  ? undefined
                  : "Add the first chemical to get started. It is created as PENDING_SDS and becomes ACTIVE once its Safety Data Sheet is attached and approved."
              }
              action={!filtered ? <NewChemicalDialog hazardClasses={hazardOptions} /> : undefined}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chemical</TableHead>
                      <TableHead>CAS / UN</TableHead>
                      <TableHead>Hazard classification</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>SDS review</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((c) => {
                      const days = daysUntil(c.sdsReviewDueDate);
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Link href={`/chemicals/${c.id}`} className="font-medium text-slate-900 hover:underline">
                              {c.name}
                            </Link>
                            {c.commonName && <div className="text-[11px] text-slate-400">{c.commonName}</div>}
                          </TableCell>
                          <TableCell className="tabular-nums text-slate-600">
                            {c.casNumber ?? "—"}
                            {c.unNumber && <div className="text-[11px] text-slate-400">UN {c.unNumber}</div>}
                          </TableCell>
                          <TableCell><HazardChips classes={c.hazardClasses} /></TableCell>
                          <TableCell className="text-slate-600">{c.physicalState.toLowerCase()}</TableCell>
                          <TableCell>
                            {!c.sdsAttachmentId ? (
                              <span className="text-[11px] font-medium text-amber-700">No SDS attached</span>
                            ) : c.sdsReviewOverdue ? (
                              <span className="text-[11px] font-medium text-rose-600">
                                Overdue since {fmtDate(c.sdsReviewDueDate)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                Due {fmtDate(c.sdsReviewDueDate)}
                                {days !== null && days <= 60 && <span className="ml-1 text-amber-600">({days}d)</span>}
                              </span>
                            )}
                          </TableCell>
                          <TableCell><StatusChip status={c.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TableNote>
                Showing {data.items.length} of {data.total}. Hazard classification is entered by a
                person reading the Safety Data Sheet; the sheet is attached as evidence and is not parsed.
              </TableNote>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
