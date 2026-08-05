import Link from "next/link";
import {
  CalendarRange, ClipboardList, FileSpreadsheet, AlertTriangle,
  ClipboardCheck, ShieldCheck, Repeat,
} from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import {
  ENGAGEMENT_STATUS_CHIP, ENGAGEMENT_TYPE_CHIP, SEVERITY_CHIP, fmtDate,
  engagementTypeLabel, labelize,
  type EngagementListResponse, type FindingListResponse,
} from "./lib-cams";

export const dynamic = "force-dynamic";

const NAV_TILES = [
  { href: "/cams/audits", label: "Audits", icon: ClipboardCheck, desc: "Discipline-scoped audit programme" },
  { href: "/cams/engagements", label: "Inspections", icon: ClipboardList, desc: "Routine inspections on the CAMS engine" },
  { href: "/cams/templates", label: "Templates & Libraries", icon: FileSpreadsheet, desc: "Audit libraries + clause-mapped templates" },
  { href: "/cams/findings", label: "Findings", icon: AlertTriangle, desc: "Cross-engagement findings & CAPA" },
  { href: "/cams/admin/types", label: "Audit Types", icon: ClipboardCheck, desc: "Type config & recurrence" },
];

function Kpi({ label, value, sub, tone = "slate" }: { label: string; value: string | number; sub?: string; tone?: string }) {
  const toneCls: Record<string, string> = {
    slate: "text-slate-900", emerald: "text-emerald-700", amber: "text-amber-700",
    rose: "text-rose-700", blue: "text-blue-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={"mt-1 text-2xl font-bold tabular-nums " + (toneCls[tone] ?? toneCls.slate)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default async function CamsCommandCentre() {
  await requirePermission("CAMS.READ");

  let engagements: EngagementListResponse = { items: [], total: 0, statusCounts: {}, typeCounts: {} };
  let findings: FindingListResponse = { items: [], total: 0, severityCounts: {}, statusCounts: {}, repeatCount: 0 };
  let error: string | null = null;
  try {
    [engagements, findings] = await Promise.all([
      backendFetch<EngagementListResponse>("/api/cams/unified-engagements"),
      backendFetch<FindingListResponse>("/api/cams/unified-findings"),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load CAMS command centre";
  }

  const sc = engagements.statusCounts;
  const planned = (sc.PLANNED ?? 0) + (sc.SCHEDULED ?? 0);
  const overdueAudits = engagements.items.filter(
    (e) => ["PLANNED", "SCHEDULED"].includes(e.status) && new Date(e.plannedDate) < new Date()
  ).length;
  const completed = (sc.CLOSED ?? 0) + (sc.REPORT_ISSUED ?? 0);
  const openFindings = findings.items.filter((f) => !["CLOSED", "ACCEPTED_RISK"].includes(f.status)).length;
  const openCapas = findings.items.filter((f) => f.capaId && !["CLOSED"].includes(f.capaState ?? "")).length;
  const critMajor = (findings.severityCounts.MAJOR_NC ?? 0) + (findings.severityCounts.CRITICAL_NC ?? 0);

  const upcoming = engagements.items
    .filter((e) => ["PLANNED", "SCHEDULED", "IN_PROGRESS"].includes(e.status))
    .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime())
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title="CAMS — Command Centre"
        description="Compliance & Audit Management. One engine for audits and inspections — scheduled, clause-mapped, finding-to-CAPA, with the analytics certification bodies actually ask for."
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Planned / Scheduled" value={planned} sub={`${completed} completed`} tone="blue" />
            <Kpi label="Overdue Audits" value={overdueAudits} tone={overdueAudits ? "rose" : "emerald"} />
            <Kpi label="Open Findings" value={openFindings} sub={`${findings.total} total`} tone={openFindings ? "amber" : "emerald"} />
            <Kpi label="Major / Critical NC" value={critMajor} tone={critMajor ? "rose" : "emerald"} />
            <Kpi label="Open CAPAs (Audit)" value={openCapas} tone={openCapas ? "amber" : "emerald"} />
            <Kpi label="Repeat Findings" value={findings.repeatCount} tone={findings.repeatCount ? "rose" : "emerald"} />
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NAV_TILES.map((t) => (
              <Link key={t.href} href={t.href} className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/40">
                <t.icon size={20} className="text-primary-700" />
                <div className="mt-2 text-sm font-semibold text-slate-900 group-hover:text-primary-800">{t.label}</div>
                <div className="text-xs text-slate-500">{t.desc}</div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <CalendarRange size={16} className="text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">Upcoming & in-progress engagements</h2>
                <Link href="/cams/engagements" className="ml-auto text-xs text-primary-700 hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {upcoming.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">No upcoming engagements scheduled.</div>
                ) : (
                  upcoming.map((e) => (
                    <Link key={e.id} href={e.href ?? `/cams/engagements/${e.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                      <span className={"shrink-0 rounded border px-2 py-0.5 text-[11px] " + (ENGAGEMENT_TYPE_CHIP[e.engagementType] ?? "")}>
                        {engagementTypeLabel(e.engagementType)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                        <span className="font-medium text-primary-700">{e.engagementCode}</span> — {e.title}
                        {e.sourceModule && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">via {e.sourceModule}</span>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">{fmtDate(e.plannedDate)}</span>
                      <span className={"shrink-0 rounded border px-2 py-0.5 text-[11px] " + (ENGAGEMENT_STATUS_CHIP[e.status] ?? "")}>
                        {labelize(e.status)}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <ShieldCheck size={16} className="text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">Findings by severity</h2>
              </div>
              <div className="space-y-2 p-4">
                {["CRITICAL_NC", "MAJOR_NC", "MINOR_NC", "OBSERVATION", "OPPORTUNITY_FOR_IMPROVEMENT"].map((sev) => (
                  <div key={sev} className="flex items-center justify-between">
                    <span className={"rounded border px-2 py-0.5 text-[11px] " + (SEVERITY_CHIP[sev] ?? "")}>{labelize(sev)}</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-700">{findings.severityCounts[sev] ?? 0}</span>
                  </div>
                ))}
                {findings.repeatCount > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <Repeat size={14} /> {findings.repeatCount} repeat finding(s) — a certification-readiness flag.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
