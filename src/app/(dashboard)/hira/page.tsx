import Link from "next/link";
import { Suspense } from "react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Can } from "@/components/auth/can";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { HiraAnalyticsStrip } from "@/components/hira/analytics-strip";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { code: "DRAFT", label: "Draft" },
  { code: "IN_PROGRESS", label: "In Progress" },
  { code: "TEAM_REVIEW", label: "Team Review" },
  { code: "APPROVAL_PENDING", label: "Approval Pending" },
  { code: "ACTIVE", label: "Active" },
  { code: "SUPERSEDED", label: "Superseded" }
];

const STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-800 border-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  TEAM_REVIEW: "bg-indigo-100 text-indigo-800 border-indigo-200",
  APPROVAL_PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ACTIVE: "bg-emerald-200 text-emerald-900 border-emerald-300 font-semibold",
  SUPERSEDED: "bg-slate-200 text-slate-700 border-slate-300",
  ARCHIVED: "bg-slate-200 text-slate-700 border-slate-300"
};

export default async function HiraStudiesPage(
  props: { searchParams: Promise<{ status?: string; plantId?: string }> }
) {
  const searchParams = await props.searchParams;
  // Pure 3-tier: all reads go through the FastAPI backend; no Prisma here.
  type StudyListItem = {
    id: string;
    number: string;
    plantId: string;
    departmentId: string | null;
    areaId: string | null;
    title: string;
    scopeType: string | null;
    status: string;
    initiatedAt: string;
    nextScheduledReviewDate: string | null;
    aggregateMetrics: any | null;
    teamLeaderId: string;
    plantName: string | null;
    departmentName: string | null;
    areaName: string | null;
    teamLeaderName: string | null;
    entryCount: number;
  };
  type StudyListResponse = {
    items: StudyListItem[];
    total: number;
    statusCounts: Record<string, number>;
  };

  const data = await backendFetch<StudyListResponse>("/api/hira/studies", {
    query: {
      status: searchParams.status ?? null,
      plant_id: searchParams.plantId ?? null
    }
  });

  const studies = data.items.map((s) => ({
    ...s,
    initiatedAt: new Date(s.initiatedAt),
    nextScheduledReviewDate: s.nextScheduledReviewDate ? new Date(s.nextScheduledReviewDate) : null,
    plant: { name: s.plantName ?? "" },
    department: s.departmentName ? { name: s.departmentName } : null,
    area: s.areaName ? { name: s.areaName } : null,
    teamLeader: { name: s.teamLeaderName ?? "" },
    _count: { entries: s.entryCount }
  }));

  const statusCountMap = data.statusCounts;
  const all = Object.values(statusCountMap).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title="HIRA Studies"
        description="Hazard Identification and Risk Assessment — the live risk register"
        action={
          <Can permission="HIRA.CREATE">
            <Button asChild>
              <Link href="/hira/new">
                <Plus size={16} /> New Study
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <HiraAnalyticsStrip />
        </Suspense>
      </div>

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href="/hira" label="All" count={all} active={!searchParams.status} />
        {STATUS_OPTIONS.map((s) => (
          <FilterTab
            key={s.code}
            href={`/hira?status=${s.code}`}
            label={s.label}
            count={statusCountMap[s.code] ?? 0}
            active={searchParams.status === s.code}
          />
        ))}
      </FilterTabsList>

      {studies.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Study</th>
                <th className="text-left px-4 py-3">Scope</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Entries</th>
                <th className="text-left px-4 py-3">Team Lead</th>
                <th className="text-left px-4 py-3">Next Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studies.map((s) => {
                const scopeBits = [
                  s.plant?.name,
                  s.department?.name,
                  s.area?.name
                ].filter(Boolean);
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/hira/${s.id}`}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {s.number}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {s.title}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {scopeBits.map((b) => (
                          <span
                            key={b}
                            className="inline-block px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded border ${
                          STATUS_CHIP[s.status] ?? "bg-slate-100 text-slate-800 border-slate-200"
                        }`}
                      >
                        {s.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s._count.entries}</td>
                    <td className="px-4 py-3 text-slate-700">{s.teamLeader?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {s.nextScheduledReviewDate
                        ? new Date(s.nextScheduledReviewDate).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border bg-white p-10 text-center">
      <div className="text-lg font-medium text-slate-700">No HIRA studies yet</div>
      <div className="text-sm text-slate-500 mt-2 max-w-xl mx-auto">
        A HIRA (Hazard Identification and Risk Assessment) study scopes a set of activities, identifies the hazards
        they present, and analyses the risk before and after the controls in place. Studies are reviewed annually,
        triggered by incidents, or triggered by management of change.
      </div>
      <Can permission="HIRA.CREATE">
        <div className="mt-6">
          <Button asChild>
            <Link href="/hira/new">
              <Plus size={16} /> Create your first study
            </Link>
          </Button>
        </div>
      </Can>
    </div>
  );
}
