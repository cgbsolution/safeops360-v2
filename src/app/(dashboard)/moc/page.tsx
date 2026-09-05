import Link from "next/link";
import { Suspense } from "react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PlantSwitcher } from "@/components/plant-switcher";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { resolvePlantContext } from "@/lib/plant-context";
import { cn } from "@/lib/utils";
import { Plus, GitBranch, Download } from "lucide-react";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { MocAnalyticsStrip } from "@/components/moc/analytics-strip";
import { InsightBar } from "@/components/ai/InsightBar";
import { SignalChip } from "@/components/ai/SignalChip";
import { fetchInsights } from "@/lib/insights";
import {
  CLASSIFICATION_CHIP,
  CLASSIFICATIONS,
  STATUS_CHIP,
  STATUS_LABEL,
  CATEGORY_LABEL,
  RISK_CHIP
} from "./_meta";
import { AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Metrics = {
  total: number;
  active: number;
  overdue: number;
  temporaryExpiringSoon: number;
  temporaryExpiring7d: number;
  emergencyPendingRetro: number;
  overdueApprovals: number;
  closedSuccessful: number;
  byStatus: Record<string, number>;
  byClassification: Record<string, number>;
  byRisk: Record<string, number>;
};

type CRListItem = {
  id: string;
  number: string;
  title: string;
  category: string;
  classification: string;
  status: string;
  isTemporary: boolean;
  temporaryExpiryDate: string | null;
  origin: string;
  initiatedByUserId: string;
  initiatedAt: string | null;
  targetCompletionDate: string | null;
  overallResidualRisk: string | null;
  urgency: string;
  emergencyPendingRetro: boolean;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export default async function MocLandingPage(props: {
  searchParams: Promise<{ plantId?: string; classification?: string; view?: string; insight?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(searchParams.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader title="Management of Change" description="Govern every planned change before it happens — ISO 45001 §8.1.3" />
        <Card className="rounded-xl border bg-white p-10 text-center text-slate-500 shadow-none">
          Select a plant to view its change requests.
        </Card>
      </div>
    );
  }

  const [metrics, data, insights] = await Promise.all([
    backendFetch<Metrics>("/api/moc/metrics", { query: { plantId } }).catch(
      () =>
        ({
          total: 0,
          active: 0,
          overdue: 0,
          temporaryExpiringSoon: 0,
          temporaryExpiring7d: 0,
          emergencyPendingRetro: 0,
          overdueApprovals: 0,
          closedSuccessful: 0,
          byStatus: {},
          byClassification: {},
          byRisk: {}
        }) as Metrics
    ),
    backendFetch<{ items: CRListItem[]; total: number }>("/api/moc/change-requests", {
      query: { plantId, classification: searchParams.classification ?? null }
    }).catch(() => ({ items: [], total: 0 })),
    fetchInsights("moc", { plant: plantId })
  ]);

  // Attention filters run over the loaded set (the register is un-paginated).
  const view = searchParams.view;
  const now = Date.now();
  const items = data.items.filter((cr) => {
    if (view === "emergency") return cr.emergencyPendingRetro;
    if (view === "overdue_approvals") return cr.status === "under_approval";
    if (view === "temp_expiring")
      return (
        cr.isTemporary &&
        cr.temporaryExpiryDate != null &&
        new Date(cr.temporaryExpiryDate).getTime() - now <= 7 * 86400_000 &&
        new Date(cr.temporaryExpiryDate).getTime() - now >= 0
      );
    return true;
  });

  const attentionTabs: { key: string; label: string; count: number }[] = [
    { key: "overdue_approvals", label: "Overdue approvals", count: metrics.overdueApprovals },
    { key: "temp_expiring", label: "Temp expiring ≤7d", count: metrics.temporaryExpiring7d },
    { key: "emergency", label: "Emergency — pending retro", count: metrics.emergencyPendingRetro }
  ].filter((t) => t.count > 0);

  // Insight-card click-through: narrow the (already view-filtered) list to the
  // active insight's change requests.
  const activeInsight = searchParams.insight
    ? insights.bar.find((i) => i.id === searchParams.insight)
    : undefined;
  const visibleItems = activeInsight
    ? items.filter((cr) => activeInsight.recordRefs.includes(cr.number))
    : items;

  return (
    <div>
      <PageHeader
        title="Management of Change"
        description="Govern every planned change before it happens — ISO 45001 §8.1.3 · ISO 14001 §8.1 · ISO 9001 §8.5.6"
        action={
          <div className="flex items-center gap-2">
            <PlantSwitcher plants={plants} currentPlantId={plantId} />
            <Button asChild variant="outline">
              <a href={`/api/moc/export?plantId=${plantId}`}>
                <Download size={16} /> Export
              </a>
            </Button>
            <Button asChild>
              <Link href={`/moc/new?plantId=${plantId}`}>
                <Plus size={16} /> Submit New Change
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <MocAnalyticsStrip />
        </Suspense>
      </div>

      <InsightBar insights={insights.bar} />

      <FilterTabsList label="Classification" className="mb-4">
        <FilterTab
          href={`/moc?plantId=${plantId}`}
          label="All"
          count={metrics.total}
          active={!searchParams.classification}
        />
        {CLASSIFICATIONS.map((c) => (
          <FilterTab
            key={c}
            href={`/moc?plantId=${plantId}&classification=${c}`}
            label={c[0].toUpperCase() + c.slice(1)}
            count={metrics.byClassification[c] ?? 0}
            active={searchParams.classification === c}
          />
        ))}
      </FilterTabsList>

      {attentionTabs.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">Needs attention</span>
          {view && (
            <Link href={`/moc?plantId=${plantId}`} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:border-slate-400">
              Clear filter
            </Link>
          )}
          {attentionTabs.map((t) => (
            <Link
              key={t.key}
              href={`/moc?plantId=${plantId}&view=${t.key}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
                view === t.key
                  ? "border-amber-400 bg-amber-100 text-amber-900"
                  : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
              )}
            >
              <AlertTriangle size={12} /> {t.label} · {t.count}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="rounded-xl border bg-white p-10 text-center text-slate-500 shadow-none">
          <GitBranch className="mx-auto mb-2 text-slate-300" size={32} />
          No change requests{searchParams.classification ? " for this filter" : " yet"}.
        </Card>
      ) : (
        <Card className="overflow-x-auto rounded-xl border bg-white shadow-none">
          <Table className="w-full text-sm">
            <TableHeader className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <TableRow>
                <TableHead className="text-left px-4 py-3">MOC</TableHead>
                <TableHead className="text-left px-4 py-3">Category</TableHead>
                <TableHead className="text-left px-4 py-3">Class</TableHead>
                <TableHead className="text-left px-4 py-3">Risk</TableHead>
                <TableHead className="text-left px-4 py-3">Status</TableHead>
                <TableHead className="text-left px-4 py-3">Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {visibleItems.map((cr) => (
                <TableRow key={cr.id} className="hover:bg-slate-50/60">
                  <TableCell className="px-4 py-3">
                    <Link href={`/moc/${cr.id}`} className="block">
                      <div className="font-mono text-xs text-slate-500">{cr.number}</div>
                      <div className="font-medium text-slate-900">
                        {cr.title}
                        {cr.isTemporary && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                            temp
                          </span>
                        )}
                        {cr.emergencyPendingRetro && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-300 rounded px-1 py-0.5">
                            <AlertTriangle size={10} /> emergency
                          </span>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-700">{CATEGORY_LABEL[cr.category] ?? cr.category}</TableCell>
                  <TableCell className="px-4 py-3">
                    <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize", CLASSIFICATION_CHIP[cr.classification] ?? "bg-slate-100 text-slate-700 border-slate-200")}>
                      {cr.classification}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {cr.overallResidualRisk ? (
                      <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize", RISK_CHIP[cr.overallResidualRisk] ?? "bg-slate-100 text-slate-700 border-slate-200")}>
                        {cr.overallResidualRisk}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-medium", STATUS_CHIP[cr.status] ?? "bg-slate-100 text-slate-700 border-slate-200")}>
                        {STATUS_LABEL[cr.status] ?? cr.status}
                      </span>
                      {insights.signalByRecord.get(cr.id) && (
                        <SignalChip signal={insights.signalByRecord.get(cr.id)!} href={`/moc/${cr.id}`} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(cr.targetCompletionDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
