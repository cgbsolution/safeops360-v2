"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ClipboardCheck, Plus, AlertTriangle, CheckCircle2, CalendarClock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { usePermission } from "@/components/auth/can";
import {
  AuditRow, ProgrammeDashboard, AuditLibrary, AuditTemplate, PlantUser,
  STATUS_CHIP, STATUS_LABEL, Chip, fmtDate, complianceColor, complianceBg, INDUSTRY_LABEL,
} from "./lib";
import { ScheduleModal } from "./schedule-modal";

export function ProgrammeView({
  plantId, audits, dashboard, templates, libraries, users,
}: {
  plantId: string | null;
  audits: AuditRow[];
  dashboard: ProgrammeDashboard | null;
  templates: AuditTemplate[];
  libraries: AuditLibrary[];
  users: PlantUser[];
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const canCreate = usePermission("AUDIT_COMPLIANCE.CREATE");

  const rows = useMemo(
    () =>
      audits.filter(
        (a) =>
          (!status || a.status === status) &&
          (!q || `${a.auditNumber} ${a.title} ${a.industryCode}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [audits, q, status],
  );

  const chartData = useMemo(
    () =>
      audits
        .filter((a) => a.overallCompliancePct != null)
        .slice(0, 8)
        .map((a) => ({ name: a.auditNumber.replace("AUD-GT-2026-", ""), pct: a.overallCompliancePct as number })),
    [audits],
  );

  return (
    <div className="space-y-5">
      {/* Summary metric strip */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Metric label="Audits" value={dashboard.total} icon={<ClipboardCheck size={16} />} tone="slate" />
          <Metric label="In flight" value={dashboard.open} icon={<BarChart3 size={16} />} tone={dashboard.open ? "sky" : "slate"} />
          <Metric label="Closed" value={dashboard.closed} icon={<CheckCircle2 size={16} />} tone="emerald" />
          <Metric
            label="Avg compliance"
            value={dashboard.averageCompliancePct != null ? `${dashboard.averageCompliancePct}%` : "—"}
            tone={dashboard.averageCompliancePct != null && dashboard.averageCompliancePct < 75 ? "rose" : "violet"}
          />
          <Metric label="Critical findings" value={dashboard.criticalFindings} icon={<AlertTriangle size={16} />} tone={dashboard.criticalFindings ? "rose" : "slate"} />
          <Metric label="Open CAPAs" value={dashboard.openCapas} tone={dashboard.openCapas ? "amber" : "slate"} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Compliance chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Compliance score by audit</h3>
            <span className="text-xs text-slate-400">scored audits</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={chartData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v: any) => [`${v}%`, "Compliance"]} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.pct >= 90 ? "#10b981" : d.pct >= 75 ? "#f59e0b" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[210px] items-center justify-center text-sm text-slate-400">No scored audits yet.</div>
          )}
        </div>

        {/* Next scheduled + status breakdown */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CalendarClock size={15} className="text-violet-700" /> Next scheduled
            </div>
            {dashboard?.nextScheduled ? (
              <Link href={`/audit-compliance/${dashboard.nextScheduled.id}`} className="block rounded-lg border border-slate-100 bg-slate-50 p-3 hover:border-violet-200">
                <div className="text-xs font-medium text-violet-800">{dashboard.nextScheduled.auditNumber}</div>
                <div className="truncate text-sm text-slate-700">{dashboard.nextScheduled.title}</div>
                <div className="mt-1 text-xs text-slate-500">{fmtDate(dashboard.nextScheduled.scheduledDate)}</div>
              </Link>
            ) : (
              <div className="text-sm text-slate-400">Nothing scheduled.</div>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">By status</div>
            <div className="space-y-2">
              {Object.entries(dashboard?.byStatus ?? {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs">
                  <Chip map={STATUS_CHIP} value={k} label={STATUS_LABEL[k] ?? k} />
                  <span className="font-semibold tabular-nums text-slate-700">{v}</span>
                </div>
              ))}
              {!dashboard?.byStatus || Object.keys(dashboard.byStatus).length === 0 ? (
                <div className="text-sm text-slate-400">No audits.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Audit register */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number / title…" className="h-9 w-64" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto">
            <option value="">All status</option>
            {Object.keys(STATUS_LABEL).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
          <span className="ml-auto text-xs text-slate-500">{rows.length} audits</span>
          {canCreate && (
            <Button type="button" size="sm" onClick={() => setShowSchedule(true)}>
              <Plus size={14} /> Schedule Audit
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Audit</th>
                <th className="px-3 py-2 text-left">Industry</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Progress</th>
                <th className="px-3 py-2 text-left">Compliance</th>
                <th className="px-3 py-2 text-left">Findings</th>
                <th className="px-3 py-2 text-left">Scheduled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => {
                const pct = a.totalCheckpoints ? Math.round((a.answeredCheckpoints / a.totalCheckpoints) * 100) : 0;
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={`/audit-compliance/${a.id}`} className="font-medium text-violet-800 hover:underline">{a.auditNumber}</Link>
                      <div className="max-w-xs truncate text-[12px] text-slate-600">{a.title}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{INDUSTRY_LABEL[a.industryCode] ?? a.industryCode}</td>
                    <td className="px-3 py-2"><Chip map={STATUS_CHIP} value={a.status} label={STATUS_LABEL[a.status] ?? a.status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] tabular-nums text-slate-500">{a.answeredCheckpoints}/{a.totalCheckpoints ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {a.overallCompliancePct != null ? (
                        <span className={cn("text-sm font-bold tabular-nums", complianceColor(a.overallCompliancePct))}>{a.overallCompliancePct}%</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {a.criticalFailureCount > 0 ? <span className="font-medium text-rose-700">{a.criticalFailureCount} critical</span> : <span className="text-slate-400">—</span>}
                      {a.openCapaCount > 0 && <span className="ml-1 text-amber-700">· {a.openCapaCount} CAPA</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{fmtDate(a.scheduledDate)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-sm text-slate-400">No audits.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showSchedule && (
        <ScheduleModal plantId={plantId} templates={templates} libraries={libraries} users={users} onClose={() => setShowSchedule(false)} />
      )}
    </div>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: React.ReactNode; icon?: React.ReactNode; tone: string }) {
  const tones: Record<string, string> = {
    slate: "border-slate-200 bg-white text-slate-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
  };
  return (
    <Card className={cn("rounded-xl border p-3 shadow-none", tones[tone] ?? tones.slate)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-75">{icon}{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
    </Card>
  );
}
