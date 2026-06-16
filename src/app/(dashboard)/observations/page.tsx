import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Can } from "@/components/auth/can";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { statusColor, humanize, workflowChipColor } from "@/lib/utils";
import { buildObservationListWhere, getReadScope } from "@/lib/auth/list-filters";
import { ObservationsTable, type ObservationRow } from "./observations-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { ObservationAnalyticsStrip } from "@/components/observations/analytics-strip";

export const dynamic = "force-dynamic";

const SCOPE_LABELS: Record<string, string> = {
  ALL_PLANTS: "Showing observations from all plants",
  OWN_PLANT: "Showing observations from your plant",
  OWN_DEPARTMENT: "Showing observations from your department",
  OWN_RECORDS: "Showing only observations you reported or are responsible for"
};

export default async function ObservationsPage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any).id as string;

  // RBAC scope filter — without this every user sees every observation.
  // Both helpers share the same cached underlying call (React.cache) so
  // running them in parallel costs the same as one.
  const [scopeWhere, scope] = await Promise.all([
    buildObservationListWhere(userId),
    getReadScope(userId, "OBSERVATION.READ")
  ]);
  const where = {
    ...scopeWhere,
    ...(searchParams.status ? { status: searchParams.status as any } : {})
  };

  // findMany and groupBy are independent — fire them in parallel. Slim
  // the include payload to just the fields we render in the table.
  const [observations, counts] = await Promise.all([
    prisma.observation.findMany({
      where,
      select: {
        id: true,
        number: true,
        date: true,
        type: true,
        category: true,
        description: true,
        severity: true,
        status: true,
        plant: { select: { name: true } },
        area: { select: { name: true } }
      },
      orderBy: { date: "desc" },
      take: 100
    }),
    prisma.observation.groupBy({
      by: ["status"],
      where: scopeWhere,
      _count: true
    })
  ]);

  const ids = observations.map((o) => o.id);
  const instances = ids.length
    ? await prisma.workflowInstance.findMany({
        where: { module: "OBSERVATION", recordId: { in: ids } },
        select: { recordId: true, status: true, currentStepName: true }
      })
    : [];
  const instanceByRecord = new Map(instances.map((i) => [i.recordId, i]));
  const statusCounts: Record<string, number> = {};
  counts.forEach((c: { status: string; _count: number }) => {
    statusCounts[c.status] = c._count;
  });
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const rows: ObservationRow[] = observations.map((o) => {
    const inst = instanceByRecord.get(o.id);
    const workflowStep = inst ? inst.currentStepName ?? "Completed" : humanize(o.status);
    const workflowColor = inst ? workflowChipColor(inst.status) : statusColor(o.status);
    return {
      id: o.id,
      number: o.number,
      date: o.date.toISOString(),
      plantName: o.plant.name.replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
      areaName: o.area?.name ?? null,
      type: o.type,
      category: o.category,
      description: o.description,
      severity: o.severity,
      workflowStep,
      workflowColor
    };
  });

  return (
    <div>
      <PageHeader
        title="Safety Observations"
        description="Capture safe & unsafe acts and conditions across all plants"
        action={
          <Can permission="OBSERVATION.CREATE">
            <Button asChild>
              <Link href="/observations/new">
                <Plus size={16} /> New Observation
              </Link>
            </Button>
          </Can>
        }
      />

      {scope && scope !== "ALL_PLANTS" && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {SCOPE_LABELS[scope] ?? "Filtered by your access scope"}
        </div>
      )}

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <ObservationAnalyticsStrip userId={userId} />
        </Suspense>
      </div>

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href="/observations" label="All" count={total} active={!searchParams.status} />
        <FilterTab href="/observations?status=OPEN" label="Open" count={statusCounts.OPEN ?? 0} active={searchParams.status === "OPEN"} />
        <FilterTab href="/observations?status=ASSIGNED" label="Assigned" count={statusCounts.ASSIGNED ?? 0} active={searchParams.status === "ASSIGNED"} />
        <FilterTab href="/observations?status=IN_PROGRESS" label="In Progress" count={statusCounts.IN_PROGRESS ?? 0} active={searchParams.status === "IN_PROGRESS"} />
        <FilterTab href="/observations?status=CLOSED" label="Closed" count={statusCounts.CLOSED ?? 0} active={searchParams.status === "CLOSED"} />
      </FilterTabsList>

      <ObservationsTable data={rows} />
    </div>
  );
}

