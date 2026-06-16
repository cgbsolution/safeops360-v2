import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { statusColor, humanize, workflowChipColor } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import { NearMissTable, type NearMissRow } from "./near-miss-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { NearMissAnalyticsStrip } from "@/components/near-miss/analytics-strip";

export const dynamic = "force-dynamic";

export default async function NearMissPage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const where = searchParams.status ? { status: searchParams.status as any } : {};
  const [items, counts] = await Promise.all([
    prisma.nearMiss.findMany({
      where,
      select: {
        id: true,
        number: true,
        date: true,
        location: true,
        description: true,
        potentialSeverity: true,
        promotedToIncident: true,
        status: true,
        plant: { select: { name: true } }
      },
      orderBy: { date: "desc" },
      take: 100
    }),
    prisma.nearMiss.groupBy({ by: ["status"], _count: true })
  ]);

  const ids = items.map((i) => i.id);
  const instances = ids.length
    ? await prisma.workflowInstance.findMany({
        where: { module: "NEAR_MISS", recordId: { in: ids } },
        select: { recordId: true, status: true, currentStepName: true }
      })
    : [];
  const instanceByRecord = new Map(instances.map((i) => [i.recordId, i]));
  const statusCounts: Record<string, number> = {};
  counts.forEach((c) => {
    statusCounts[c.status] = c._count;
  });
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const closed = items.filter((i) => i.status === "CLOSED").length;
  const promoted = items.filter((i) => i.promotedToIncident).length;
  const critical = items.filter((i) => i.potentialSeverity === "CRITICAL").length;

  const rows: NearMissRow[] = items.map((n) => {
    const inst = instanceByRecord.get(n.id);
    const workflowStep = inst ? inst.currentStepName ?? "Completed" : humanize(n.status);
    const workflowColor = inst ? workflowChipColor(inst.status) : statusColor(n.status);
    return {
      id: n.id,
      number: n.number,
      date: n.date.toISOString(),
      plantName: n.plant.name.replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
      location: n.location ?? "",
      description: n.description,
      potentialSeverity: n.potentialSeverity,
      promotedToIncident: n.promotedToIncident,
      workflowStep,
      workflowColor
    };
  });

  return (
    <div>
      <PageHeader
        title="Near Miss Reporting"
        description="Capture unplanned events that did not cause harm but could have"
        action={
          <Can permission="NEAR_MISS.CREATE">
            <Button asChild>
              <Link href="/near-miss/new">
                <Plus size={16} /> Report Near Miss
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <NearMissAnalyticsStrip />
        </Suspense>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBox label="Total" value={items.length} tone="default" />
        <StatBox label="Closed" value={closed} tone="success" />
        <StatBox label="Critical Potential" value={critical} tone="danger" />
        <StatBox label="Promoted to Incident" value={promoted} tone="warning" />
      </div>

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href="/near-miss" label="All" count={total} active={!searchParams.status} />
        <FilterTab href="/near-miss?status=REPORTED" label="Reported" count={statusCounts.REPORTED ?? 0} active={searchParams.status === "REPORTED"} />
        <FilterTab href="/near-miss?status=UNDER_REVIEW" label="Under Review" count={statusCounts.UNDER_REVIEW ?? 0} active={searchParams.status === "UNDER_REVIEW"} />
        <FilterTab href="/near-miss?status=ACTION_ASSIGNED" label="Action Assigned" count={statusCounts.ACTION_ASSIGNED ?? 0} active={searchParams.status === "ACTION_ASSIGNED"} />
        <FilterTab href="/near-miss?status=CLOSED" label="Closed" count={statusCounts.CLOSED ?? 0} active={searchParams.status === "CLOSED"} />
      </FilterTabsList>

      <NearMissTable data={rows} />
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: "default" | "success" | "warning" | "danger" }) {
  const colors = {
    default: "bg-primary-50 text-primary-800",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-rose-50 text-rose-800"
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
