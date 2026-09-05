"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Factory,
  LayoutGrid,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Table as TableIcon,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  BAND_CHIP,
  complianceBand,
  fmtDate,
  fmtNum,
  STATUS_CHIP,
  PROFILE_STATUS_CHIP,
  titleCase,
  type FactoryProfile,
  type FactoryProfileListResponse,
} from "./lib";
import { IndiaMap } from "./india-map";
import { Card } from "@/components/ui/card";

type View = "cards" | "table" | "map";

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  pending,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  pending?: boolean;
}) {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon size={14} /> {label}
      </div>
      <div className={"mt-1 text-2xl font-bold " + (pending ? "text-slate-300" : "text-slate-900")}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </Card>
  );
}

function FactoryCard({ f }: { f: FactoryProfile }) {
  return (
    <Link
      href={`/facilities/${f.id}`}
      className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900 group-hover:text-primary-700">{f.factoryName}</div>
          <div className="text-xs text-slate-400">{f.factoryCode}</div>
        </div>
        <span className={"shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium " + (STATUS_CHIP[f.status] ?? "")}>
          {titleCase(f.status)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
        <MapPin size={12} /> {[f.city, f.state].filter(Boolean).join(", ") || "—"}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 py-1.5">
          <div className="text-sm font-semibold text-slate-800">{fmtNum(f.buildingCount)}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Buildings</div>
        </div>
        <div className="rounded-lg bg-slate-50 py-1.5">
          <div className="text-sm font-semibold text-slate-800">{fmtNum(f.totalEmployees)}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Employees</div>
        </div>
        <div className="rounded-lg bg-slate-50 py-1.5">
          {f.metrics?.auditComplianceScorePct != null ? (
            <div className="text-sm font-semibold" style={{ color: { green: "#16a34a", amber: "#d97706", red: "#dc2626", none: "#94a3b8" }[complianceBand(f.metrics.auditComplianceScorePct)] }}>
              {f.metrics.auditComplianceScorePct}%
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-300">—</div>
          )}
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Compliance</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
        <span>
          Open CAPAs <span className="font-semibold text-slate-700">{f.metrics?.openCapas ?? 0}</span>
          {(f.metrics?.overdueCapas ?? 0) > 0 && <span className="ml-1 text-rose-600">({f.metrics?.overdueCapas} overdue)</span>}
        </span>
        <span className="text-slate-300">·</span>
        <span>Last audit {fmtDate(f.metrics?.lastAuditDate)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">{f.primaryIndustry}</span>
        <div className="flex items-center gap-1.5">
          {f.certsExpiringCount > 0 && (
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              {f.certsExpiringCount} cert{f.certsExpiringCount > 1 ? "s" : ""} expiring
            </span>
          )}
          <span className={"rounded border px-2 py-0.5 text-[10px] font-medium " + (PROFILE_STATUS_CHIP[f.profileStatus] ?? "")}>
            {titleCase(f.profileStatus)}
          </span>
        </div>
      </div>
      <div className="mt-2 border-t border-slate-100 pt-2 text-right text-[11px] font-medium text-primary-700">
        Open profile — buildings · workforce · processes · certs · contacts →
      </div>
    </Link>
  );
}

export function FacilitiesDashboard({
  data,
  activeState,
}: {
  data: FactoryProfileListResponse;
  activeState: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("cards");

  const states = useMemo(
    () => Object.entries(data.stateCounts).sort((a, b) => b[1] - a[1]),
    [data.stateCounts]
  );

  const setStateFilter = (state: string | null) => {
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    router.push(`/facilities${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const ViewBtn = ({ v, icon: Icon, label }: { v: View; icon: any; label: string }) => (
    <Button
      type="button"
      variant="ghost"
      onClick={() => setView(v)}
      className={cn(
        "h-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        view === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
      )}
    >
      <Icon size={14} /> {label}
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Roll-up KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={Factory} label="Factories" value={fmtNum(data.total)} />
        <Kpi icon={Building2} label="Buildings" value={fmtNum(data.totalBuildings)} />
        <Kpi icon={Users} label="Employees" value={fmtNum(data.totalEmployees)} />
        <Kpi
          icon={ShieldCheck}
          label="Group Compliance"
          value={data.groupComplianceScore != null ? `${data.groupComplianceScore}%` : "—"}
          sub="avg audit score"
          pending={data.groupComplianceScore == null}
        />
        <Kpi
          icon={ShieldAlert}
          label="Open CAPAs"
          value={fmtNum(data.groupOpenCapas)}
          sub={data.groupOverdueCapas > 0 ? `${data.groupOverdueCapas} overdue` : "group-wide"}
        />
        <Kpi icon={ShieldAlert} label="Certs Expiring" value={fmtNum(data.certsExpiring)} sub="expiring / expired" />
      </div>

      {/* View toggle + state filter */}
      <div className="flex flex-wrap items-center gap-2">
        <ViewBtn v="cards" icon={LayoutGrid} label="Card grid" />
        <ViewBtn v="table" icon={TableIcon} label="Table" />
        <ViewBtn v="map" icon={MapPin} label="Map" />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStateFilter(null)}
            className={cn(
              "h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium",
              !activeState ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
            )}
          >
            All states
          </Button>
          {states.map(([s, n]) => (
            <Button
              key={s}
              type="button"
              variant="ghost"
              onClick={() => setStateFilter(s)}
              className={cn(
                "h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium",
                activeState === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
              )}
            >
              {s} <span className="tabular-nums opacity-70">{n}</span>
            </Button>
          ))}
        </div>
      </div>

      {data.items.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400 shadow-none">
          No factory profiles yet. Use “Add Factory” to create one.
        </Card>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((f) => (
            <FactoryCard key={f.id} f={f} />
          ))}
        </div>
      ) : view === "table" ? (
        <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
          <Table className="w-full min-w-[900px] text-sm">
            <TableHeader className="bg-slate-50/95">
              <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <TableHead className="px-3 py-2.5">Code</TableHead>
                <TableHead className="px-3 py-2.5">Factory</TableHead>
                <TableHead className="px-3 py-2.5">Location</TableHead>
                <TableHead className="px-3 py-2.5">Status</TableHead>
                <TableHead className="px-3 py-2.5 text-right">Buildings</TableHead>
                <TableHead className="px-3 py-2.5 text-right">Employees</TableHead>
                <TableHead className="px-3 py-2.5 text-right">Compliance</TableHead>
                <TableHead className="px-3 py-2.5 text-right">Open CAPAs</TableHead>
                <TableHead className="px-3 py-2.5">Industry</TableHead>
                <TableHead className="px-3 py-2.5">Profile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((f) => (
                <TableRow key={f.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <TableCell className="px-3 py-2.5">
                    <Link href={`/facilities/${f.id}`} className="font-medium text-primary-700 hover:underline">
                      {f.factoryCode}
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-slate-700">{f.factoryName}</TableCell>
                  <TableCell className="px-3 py-2.5 text-xs text-slate-500">{[f.city, f.state].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span className={"rounded border px-2 py-0.5 text-[10px] font-medium " + (STATUS_CHIP[f.status] ?? "")}>
                      {titleCase(f.status)}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums">{fmtNum(f.buildingCount)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums">{fmtNum(f.totalEmployees)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: f.metrics?.auditComplianceScorePct != null ? { green: "#16a34a", amber: "#d97706", red: "#dc2626", none: "#94a3b8" }[complianceBand(f.metrics.auditComplianceScorePct)] : "#cbd5e1" }}>
                    {f.metrics?.auditComplianceScorePct != null ? `${f.metrics.auditComplianceScorePct}%` : "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums">
                    {f.metrics?.openCapas ?? 0}
                    {(f.metrics?.overdueCapas ?? 0) > 0 && <span className="ml-1 text-[10px] text-rose-600">({f.metrics?.overdueCapas})</span>}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-xs text-slate-500">{f.primaryIndustry}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span className={"rounded border px-2 py-0.5 text-[10px] font-medium " + (PROFILE_STATUS_CHIP[f.profileStatus] ?? "")}>
                      {titleCase(f.profileStatus)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <IndiaMap factories={data.items} />
      )}

      <GroupInsights data={data} />
    </div>
  );
}

function GroupInsights({ data }: { data: FactoryProfileListResponse }) {
  if (data.items.length === 0) return null;
  const scored = data.items.filter((f) => f.metrics?.auditComplianceScorePct != null);
  const band = (b: "green" | "amber" | "red") => scored.filter((f) => complianceBand(f.metrics!.auditComplianceScorePct) === b).length;
  const expiring = data.items.filter((f) => f.certsExpiringCount > 0);
  const overdueAudit = data.items.filter((f) => (f.metrics?.overdueCapas ?? 0) > 0 || (f.metrics?.criticalFindings ?? 0) > 0);
  const laggards = [...scored].sort((a, b) => (a.metrics!.auditComplianceScorePct ?? 0) - (b.metrics!.auditComplianceScorePct ?? 0)).slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Compliance distribution</h3>
        <div className="space-y-1.5 text-xs">
          {([["green", "≥ 85%"], ["amber", "75–84%"], ["red", "< 75%"]] as const).map(([b, label]) => (
            <div key={b} className="flex items-center gap-2">
              <span className="w-16 text-slate-500">{label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={b === "green" ? "h-full bg-emerald-500" : b === "amber" ? "h-full bg-amber-500" : "h-full bg-rose-500"} style={{ width: `${(band(b) / Math.max(1, scored.length)) * 100}%` }} />
              </div>
              <span className="w-6 text-right font-semibold text-slate-700">{band(b)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Needs attention</h3>
        <ul className="space-y-1 text-xs text-slate-600">
          {laggards.map((f) => (
            <li key={f.id} className="flex justify-between">
              <span className="truncate">{f.factoryName}</span>
              <span className="font-semibold" style={{ color: { green: "#16a34a", amber: "#d97706", red: "#dc2626", none: "#94a3b8" }[complianceBand(f.metrics!.auditComplianceScorePct)] }}>
                {f.metrics!.auditComplianceScorePct}%
              </span>
            </li>
          ))}
          {laggards.length === 0 && <li className="text-slate-400">No scored factories yet.</li>}
        </ul>
      </Card>
      <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Watch-list</h3>
        <div className="space-y-1 text-xs text-slate-600">
          <div className="flex justify-between"><span>Certs expiring/expired</span><span className="font-semibold text-amber-700">{expiring.length} factory(ies)</span></div>
          <div className="flex justify-between"><span>Overdue CAPAs / critical findings</span><span className="font-semibold text-rose-700">{overdueAudit.length} factory(ies)</span></div>
          <div className="flex justify-between"><span>Total employees</span><span className="font-semibold text-slate-700">{fmtNum(data.totalEmployees)}</span></div>
        </div>
      </Card>
    </div>
  );
}
