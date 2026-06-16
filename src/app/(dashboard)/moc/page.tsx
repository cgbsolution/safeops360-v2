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
import {
  CLASSIFICATION_CHIP,
  CLASSIFICATIONS,
  STATUS_CHIP,
  STATUS_LABEL,
  CATEGORY_LABEL
} from "./_meta";

export const dynamic = "force-dynamic";

type Metrics = {
  total: number;
  active: number;
  overdue: number;
  temporaryExpiringSoon: number;
  closedSuccessful: number;
  byStatus: Record<string, number>;
  byClassification: Record<string, number>;
};

type CRListItem = {
  id: string;
  number: string;
  title: string;
  category: string;
  classification: string;
  status: string;
  isTemporary: boolean;
  origin: string;
  initiatedByUserId: string;
  initiatedAt: string | null;
  targetCompletionDate: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export default async function MocLandingPage(props: {
  searchParams: Promise<{ plantId?: string; classification?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(searchParams.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader title="Management of Change" description="Govern every planned change before it happens — ISO 45001 §8.1.3" />
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
          Select a plant to view its change requests.
        </div>
      </div>
    );
  }

  const [metrics, data] = await Promise.all([
    backendFetch<Metrics>("/api/moc/metrics", { query: { plantId } }).catch(
      () =>
        ({
          total: 0,
          active: 0,
          overdue: 0,
          temporaryExpiringSoon: 0,
          closedSuccessful: 0,
          byStatus: {},
          byClassification: {}
        }) as Metrics
    ),
    backendFetch<{ items: CRListItem[]; total: number }>("/api/moc/change-requests", {
      query: { plantId, classification: searchParams.classification ?? null }
    }).catch(() => ({ items: [], total: 0 }))
  ]);

  const items = data.items;

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

      {items.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
          <GitBranch className="mx-auto mb-2 text-slate-300" size={32} />
          No change requests{searchParams.classification ? " for this filter" : " yet"}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">MOC</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Class</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((cr) => (
                <tr key={cr.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/moc/${cr.id}`} className="block">
                      <div className="font-mono text-xs text-slate-500">{cr.number}</div>
                      <div className="font-medium text-slate-900">
                        {cr.title}
                        {cr.isTemporary && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                            temp
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{CATEGORY_LABEL[cr.category] ?? cr.category}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize", CLASSIFICATION_CHIP[cr.classification] ?? "bg-slate-100 text-slate-700 border-slate-200")}>
                      {cr.classification}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-medium", STATUS_CHIP[cr.status] ?? "bg-slate-100 text-slate-700 border-slate-200")}>
                      {STATUS_LABEL[cr.status] ?? cr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(cr.targetCompletionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
