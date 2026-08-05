import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { WorkflowEngine } from "@/lib/workflow/engine";
import { Can } from "@/components/auth/can";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { InspectionAnalyticsStrip } from "@/components/inspections/analytics-strip";
import { InspectionsTable, type InspectionRow } from "./inspections-table";

export const dynamic = "force-dynamic";

export default async function InspectionsPage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;

  try {
    await WorkflowEngine.sweepInspectionStatus();
  } catch (e) {
    console.error("Inspection sweep failed:", e);
  }

  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;

  const [items, counts] = await Promise.all([
    prisma.inspection.findMany({
      where,
      select: {
        id: true,
        number: true,
        scheduledDate: true,
        result: true,
        status: true,
        plant: { select: { name: true } },
        equipment: { select: { name: true, category: true, frequency: true } },
        inspector: { select: { name: true } }
      },
      // Newest-created first (platform-wide list convention) — a just-raised
      // inspection must lead, even when scheduled for a past date.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100
    }),
    prisma.inspection.groupBy({ by: ["status"], _count: true })
  ]);
  const statusCounts: Record<string, number> = {};
  counts.forEach((c) => {
    statusCounts[c.status] = c._count;
  });

  const rows: InspectionRow[] = items.map((i) => ({
    id: i.id,
    number: i.number ?? null,
    equipmentName: i.equipment.name,
    equipmentCategory: i.equipment.category,
    plantName: i.plant.name.replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
    frequency: i.equipment.frequency,
    scheduledDate: i.scheduledDate.toISOString(),
    inspectorName: i.inspector?.name ?? null,
    result: i.result ?? null,
    status: i.status
  }));

  return (
    <div>
      <PageHeader
        title="Inspection Schedule"
        description="Periodic inspection of safety-critical equipment & infrastructure. Schedules are auto-generated from equipment master."
        action={
          <div className="flex gap-2">
            <Can permission="INSPECTION.SCHEDULE">
              <Button asChild variant="ghost">
                <Link href="/inspections/inbox">My Inbox</Link>
              </Button>
            </Can>
            <Can permission="INSPECTION_FINDING.READ">
              <Button asChild variant="ghost">
                <Link href="/inspections/findings">Findings</Link>
              </Button>
            </Can>
            <Can permission="INSPECTION.READ">
              <Button asChild variant="ghost">
                <Link href="/inspections/analytics">Analytics</Link>
              </Button>
            </Can>
            <Can permission="INSPECTION.CREATE">
              <Button asChild>
                <Link href="/inspections/new">
                  <Plus size={16} /> New Inspection
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-6">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <InspectionAnalyticsStrip />
        </Suspense>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <FilterCard href="/inspections" label="All" count={Object.values(statusCounts).reduce((a, b) => a + b, 0)} active={!searchParams.status} />
        <FilterCard href="/inspections?status=COMPLETED" label="Completed" count={statusCounts.COMPLETED ?? 0} active={searchParams.status === "COMPLETED"} tone="success" />
        <FilterCard href="/inspections?status=DUE" label="Due" count={statusCounts.DUE ?? 0} active={searchParams.status === "DUE"} tone="warning" />
        <FilterCard href="/inspections?status=SCHEDULED" label="Scheduled" count={statusCounts.SCHEDULED ?? 0} active={searchParams.status === "SCHEDULED"} />
        <FilterCard href="/inspections?status=OVERDUE" label="Overdue" count={statusCounts.OVERDUE ?? 0} active={searchParams.status === "OVERDUE"} tone="danger" />
      </div>

      <InspectionsTable data={rows} />
    </div>
  );
}

function FilterCard({
  href,
  label,
  count,
  active,
  tone = "default"
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const colors = active
    ? {
        default: "bg-primary-700 text-white border-primary-700",
        success: "bg-emerald-700 text-white border-emerald-700",
        warning: "bg-amber-600 text-white border-amber-600",
        danger: "bg-rose-700 text-white border-rose-700"
      }
    : {
        default: "bg-white text-slate-700 hover:bg-slate-50",
        success: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
        warning: "bg-amber-50 text-amber-800 hover:bg-amber-100",
        danger: "bg-rose-50 text-rose-800 hover:bg-rose-100"
      };

  return (
    <Link href={href} className={`rounded-xl border p-4 transition ${colors[tone]}`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{count}</div>
    </Link>
  );
}
