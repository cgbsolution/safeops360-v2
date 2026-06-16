import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { sweepInspectionStatus } from "@/lib/inspections/schedule-generator";
import { InspectionInboxTable, type InboxRow } from "./inbox-table";

export const dynamic = "force-dynamic";

export default async function InspectionInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any).id;

  try {
    await sweepInspectionStatus();
  } catch {}

  const items = await prisma.inspection.findMany({
    where: {
      inspectorId: userId,
      status: { in: ["SCHEDULED", "DUE", "IN_PROGRESS", "OVERDUE"] }
    },
    select: {
      id: true,
      number: true,
      scheduledDate: true,
      status: true,
      equipment: { select: { name: true, code: true } },
      plant: { select: { code: true } },
      inspectionType: { select: { name: true, isStatutory: true } }
    },
    orderBy: { scheduledDate: "asc" }
  });

  const overdue = items.filter((i) => i.status === "OVERDUE");
  const dueToday = items.filter((i) => i.status === "DUE");
  const upcoming = items.filter((i) => i.status === "SCHEDULED");
  const inProgress = items.filter((i) => i.status === "IN_PROGRESS");

  const rows: InboxRow[] = items.map((i) => ({
    id: i.id,
    number: i.number ?? null,
    equipmentName: i.equipment.name,
    equipmentCode: i.equipment.code,
    isStatutory: i.inspectionType?.isStatutory ?? false,
    plantCode: i.plant.code,
    inspectionTypeName: i.inspectionType?.name ?? null,
    scheduledDate: i.scheduledDate.toISOString(),
    status: i.status
  }));

  return (
    <div>
      <PageHeader
        title="My Inspections"
        description={`Inspections assigned to you across all plants. ${overdue.length} overdue · ${dueToday.length} due now · ${upcoming.length} upcoming`}
        breadcrumbs={[{ label: "Inspections", href: "/inspections" }, { label: "My Inbox" }]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryStat label="Overdue" value={overdue.length} tone="rose" />
        <SummaryStat label="Due now" value={dueToday.length} tone="amber" />
        <SummaryStat label="In progress" value={inProgress.length} tone="blue" />
        <SummaryStat label="Upcoming" value={upcoming.length} tone="slate" />
      </div>

      <InspectionInboxTable data={rows} />
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: "rose" | "amber" | "blue" | "slate" | "emerald" }) {
  const tones: Record<string, string> = {
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900"
  };
  return (
    <div className={["rounded-md border p-3", tones[tone]].join(" ")}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
