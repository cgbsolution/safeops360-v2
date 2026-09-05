import Link from "next/link";
import { Suspense } from "react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { CapaAnalyticsStrip } from "@/components/capa/analytics-strip";
import { InsightBar } from "@/components/ai/InsightBar";
import { SignalChip } from "@/components/ai/SignalChip";
import { InsightHero } from "@/components/observations/insight-hero";
import { ObservationAnalyticsPanels } from "@/components/observations/analytics-panels";
import { buildHeroFromRecords } from "@/lib/insight-hero-from-records";
import { fetchInsights } from "@/lib/insights";
import { Plus, FileDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type CapaListItem = {
  id: string;
  capaNumber: string;
  aliasNumber: string | null;
  title: string;
  plantId: string;
  sourceCategoryCode: string | null;
  sourceTypeCode: string;
  sourceReferenceSummary: string | null;
  severity: string;
  priority: string;
  state: string;
  primaryOwnerUserId: string;
  primaryOwnerName: string | null;
  closureTargetDate: string | null;
  detectedAt: string;
  createdAt: string;
  daysOpen: number;
  daysOverdue: number;
  actionCount: number;
};

type ListResp = {
  items: CapaListItem[];
  total: number;
  sourceCategoryCounts: Record<string, number>;
  stateCounts: Record<string, number>;
  severityCounts: Record<string, number>;
};

const STATE_OPTIONS = [
  { code: "DRAFT", label: "Draft" },
  { code: "SUBMITTED", label: "Submitted" },
  { code: "UNDER_RCA", label: "Under RCA" },
  { code: "ACTIONS_PLANNED", label: "Actions Planned" },
  { code: "ACTIONS_IN_PROGRESS", label: "In Progress" },
  { code: "PENDING_VERIFICATION", label: "Pending Verification" },
  { code: "VERIFIED", label: "Verified" },
  { code: "CLOSED", label: "Closed" }
];

const SOURCE_CHIP: Record<string, string> = {
  SAFETY: "bg-rose-100 text-rose-800 border-rose-200",
  QUALITY: "bg-blue-100 text-blue-800 border-blue-200",
  ENVIRONMENTAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ORGANIZATIONAL: "bg-purple-100 text-purple-800 border-purple-200",
  REGULATORY: "bg-amber-100 text-amber-800 border-amber-200",
  OTHER: "bg-slate-100 text-slate-700 border-slate-200"
};

const STATE_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200",
  UNDER_RCA: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ACTIONS_PLANNED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIONS_IN_PROGRESS: "bg-orange-100 text-orange-800 border-orange-200",
  PENDING_VERIFICATION: "bg-cyan-100 text-cyan-800 border-cyan-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSED: "bg-emerald-200 text-emerald-900 border-emerald-300 font-semibold",
  CLOSED_RECURRED: "bg-rose-200 text-rose-900 border-rose-300",
  REJECTED: "bg-slate-200 text-slate-700 border-slate-300",
  CANCELLED: "bg-slate-200 text-slate-700 border-slate-300"
};

const SEVERITY_CHIP: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MODERATE: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-rose-200 text-rose-900 border-rose-300 font-semibold"
};

export default async function CapaListPage(
  props: { searchParams: Promise<{ state?: string; source?: string; severity?: string; insight?: string }> }
) {
  const sp = await props.searchParams;

  const [data, insights] = await Promise.all([
    backendFetch<ListResp>("/api/capa", {
      query: {
        state: sp.state ?? null,
        sourceCategory: sp.source ?? null,
        severity: sp.severity ?? null
      }
    }),
    fetchInsights("capa")
  ]);

  const all = Object.values(data.stateCounts).reduce((a, b) => a + b, 0);

  // Insight-card click-through: narrow the list to the active insight's CAPAs.
  const activeInsight = sp.insight
    ? insights.bar.find((i) => i.id === sp.insight)
    : undefined;
  const visibleItems = activeInsight
    ? data.items.filter((c) => activeInsight.recordRefs.includes(c.capaNumber))
    : data.items;

  // "This week's focus" hero + panels — reuse the shared builder + component.
  const CAPA_OPEN = new Set(["DRAFT", "SUBMITTED", "UNDER_RCA", "ACTIONS_PLANNED", "ACTIONS_IN_PROGRESS", "PENDING_VERIFICATION"]);
  const capaOpen = data.items.filter((c) => CAPA_OPEN.has(c.state));
  const capaHero = buildHeroFromRecords(
    data.items.map((c) => ({
      date: new Date(c.createdAt),
      open: CAPA_OPEN.has(c.state),
      severity: c.severity,
      group: (c.sourceCategoryCode ?? "OTHER").replace(/_/g, " ")
    })),
    {
      type: "capa risk",
      critical: ["CRITICAL", "HIGH"],
      headline: (n, g) => `${n} serious CAPAs open — mostly ${g}`,
      qualifier: "audit exposure",
      actionHref: "/capa?severity=CRITICAL",
      railTitle: "By source",
      closing: (d) => `Oldest open CAPA is ${d} days.`,
      statLabels: { critical: "critical", high: "high" }
    }
  );
  const capaStateAgg = new Map<string, { count: number; totalDays: number }>();
  capaOpen.forEach((c) => {
    const e = capaStateAgg.get(c.state) ?? { count: 0, totalDays: 0 };
    e.count += 1;
    e.totalDays += c.daysOpen;
    capaStateAgg.set(c.state, e);
  });
  const capaBottleneck = Array.from(capaStateAgg.entries())
    .map(([step, v]) => ({ step: step.replace(/_/g, " "), count: v.count, avgDays: Math.round((v.totalDays / v.count) * 10) / 10 }))
    .sort((a, b) => b.avgDays - a.avgDays);
  const capaCatAgg = new Map<string, { count: number; areas: Set<string> }>();
  capaOpen.forEach((c) => {
    const cat = c.sourceCategoryCode ?? "OTHER";
    const e = capaCatAgg.get(cat) ?? { count: 0, areas: new Set<string>() };
    e.count += 1;
    e.areas.add(c.plantId);
    capaCatAgg.set(cat, e);
  });
  const capaCategory = Array.from(capaCatAgg.entries())
    .map(([category, v]) => ({ category, count: v.count, areaCount: v.areas.size }))
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHeader
        title="CAPA Management"
        description="Corrective and Preventive Actions — unified across safety, quality, environmental, audit, and other sources"
        action={
          <div className="flex gap-2">
            <Can permission="CAPA.EXPORT">
              <a
                href={`/api/capa/export?format=csv${sp.source ? `&sourceCategory=${sp.source}` : ""}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-slate-300 bg-white hover:border-primary-500"
              >
                <FileDown size={14} /> CSV
              </a>
              <a
                href={`/api/capa/export?format=xlsx${sp.source ? `&sourceCategory=${sp.source}` : ""}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-slate-300 bg-white hover:border-primary-500"
              >
                <FileDown size={14} /> Excel
              </a>
            </Can>
            <Can permission="CAPA.CREATE">
              <div className="relative group">
                <Button>
                  <Plus size={16} /> New CAPA
                </Button>
                <Card className="hidden group-hover:block absolute right-0 mt-1 w-64 rounded-lg border bg-white shadow-lg z-10">
                  <ul className="py-1 text-sm">
                    {[
                      { href: "/capa/new/manual", label: "Manual", desc: "Free-form, no source" },
                      { href: "/capa/new/audit", label: "Audit Finding", desc: "Internal / external / regulatory" },
                      { href: "/capa/new/customer-complaint", label: "Customer Complaint", desc: "From customer feedback" },
                      { href: "/capa/new/quality-ncr", label: "Quality NCR", desc: "Non-conformance report" },
                      { href: "/capa/new/calibration", label: "Calibration Failure", desc: "Instrument out of calibration" },
                      { href: "/capa/new/environmental", label: "Environmental", desc: "Emission / spill / permit" },
                      { href: "/capa/new/management-review", label: "Management Review", desc: "Action from MGR meeting" }
                    ].map((s) => (
                      <li key={s.href}>
                        <Link
                          href={s.href}
                          className="block px-3 py-2 hover:bg-slate-50 border-b last:border-b-0"
                        >
                          <div className="font-medium text-slate-800">{s.label}</div>
                          <div className="text-xs text-slate-500">{s.desc}</div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </Can>
          </div>
        }
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <CapaAnalyticsStrip />
        </Suspense>
      </div>

      {capaHero ? <InsightHero hero={capaHero} /> : <InsightBar insights={insights.bar} />}

      {(capaBottleneck.length > 0 || capaCategory.length > 0) && (
        <ObservationAnalyticsPanels
          bottleneck={capaBottleneck}
          category={capaCategory}
          activeCategory={null}
          basePath="/capa"
          concentratedTitle="By source"
        />
      )}

      <FilterTabsList label="Source" className="mb-3">
        <FilterTab href="/capa" label="All" count={all} active={!sp.source} />
        {Object.entries(data.sourceCategoryCounts).map(([code, count]) => (
          <FilterTab
            key={code}
            href={`/capa?source=${code}`}
            label={code.replace(/_/g, " ")}
            count={count}
            active={sp.source === code}
          />
        ))}
      </FilterTabsList>

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href={`/capa${sp.source ? `?source=${sp.source}` : ""}`} label="All" count={all} active={!sp.state} />
        {STATE_OPTIONS.map((s) => {
          const params = new URLSearchParams();
          if (sp.source) params.set("source", sp.source);
          params.set("state", s.code);
          return (
            <FilterTab
              key={s.code}
              href={`/capa?${params.toString()}`}
              label={s.label}
              count={data.stateCounts[s.code] ?? 0}
              active={sp.state === s.code}
            />
          );
        })}
      </FilterTabsList>

      {data.items.length === 0 ? (
        <Card className="rounded-xl border bg-white p-8 text-center text-slate-500 shadow-none">
          No CAPAs match the current filter.
        </Card>
      ) : (
        <Card className="overflow-x-auto rounded-xl border bg-white shadow-none">
          <Table className="w-full text-sm">
            <TableHeader className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider">
              <TableRow>
                <TableHead className="text-left px-4 py-3">CAPA</TableHead>
                <TableHead className="text-left px-4 py-3">Source</TableHead>
                <TableHead className="text-left px-4 py-3">Severity</TableHead>
                <TableHead className="text-left px-4 py-3">State</TableHead>
                <TableHead className="text-left px-4 py-3">Owner</TableHead>
                <TableHead className="text-left px-4 py-3">Days Open</TableHead>
                <TableHead className="text-left px-4 py-3">Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {visibleItems.map((c) => (
                <TableRow
                  key={c.id}
                  className={c.daysOverdue > 0 ? "bg-rose-50/40 hover:bg-rose-50/60" : "hover:bg-slate-50"}
                >
                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/capa/${c.id}`}
                      className="font-mono text-xs text-primary-700 hover:underline"
                    >
                      {c.capaNumber}
                    </Link>
                    {c.aliasNumber && c.aliasNumber !== c.capaNumber && (
                      <div className="text-[10px] text-slate-400 mt-0.5">alias: {c.aliasNumber}</div>
                    )}
                    <div className="text-xs text-slate-700 mt-0.5 line-clamp-1">{c.title}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded border ${
                        SOURCE_CHIP[c.sourceCategoryCode ?? "OTHER"] ?? "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {c.sourceTypeCode.replace(/_/g, " ")}
                    </span>
                    {c.sourceReferenceSummary && (
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{c.sourceReferenceSummary}</div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded border ${
                        SEVERITY_CHIP[c.severity] ?? "bg-slate-100 text-slate-800 border-slate-200"
                      }`}
                    >
                      {c.severity}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded border ${
                          STATE_CHIP[c.state] ?? "bg-slate-100 text-slate-800 border-slate-200"
                        }`}
                      >
                        {c.state.replace(/_/g, " ")}
                      </span>
                      {insights.signalByRecord.get(c.id) && (
                        <SignalChip signal={insights.signalByRecord.get(c.id)!} href={`/capa/${c.id}`} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-700">{c.primaryOwnerName ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3 text-xs">
                    {c.daysOverdue > 0 ? (
                      <span className="text-rose-700 font-semibold">{c.daysOverdue}d overdue</span>
                    ) : (
                      <span className="text-slate-700">{c.daysOpen}d</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-700">
                    {c.closureTargetDate ? new Date(c.closureTargetDate).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

