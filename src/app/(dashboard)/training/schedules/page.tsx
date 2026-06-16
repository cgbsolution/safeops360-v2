import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Can } from "@/components/auth/can";
import { SchedulesTable, type ScheduleRow } from "./schedules-table";

export const dynamic = "force-dynamic";

type Filter = "all" | "draft" | "published" | "open" | "active" | "completed" | "cancelled";

export default async function TrainingSchedulesPage(props: { searchParams: Promise<{ filter?: Filter }> }) {
  const searchParams = await props.searchParams;
  const filter = (searchParams.filter ?? "all") as Filter;

  const where: any = {};
  if (filter === "draft") where.status = "DRAFT";
  else if (filter === "published") where.status = "PUBLISHED";
  else if (filter === "open") where.status = "NOMINATIONS_OPEN";
  else if (filter === "active") where.status = "IN_PROGRESS";
  else if (filter === "completed") where.status = "COMPLETED";
  else if (filter === "cancelled") where.status = "CANCELLED";

  const [schedules, counts] = await Promise.all([
    prisma.trainingSchedule.findMany({
      where,
      select: {
        id: true,
        scheduleNumber: true,
        venue: true,
        startDate: true,
        endDate: true,
        isExternalTrainer: true,
        externalTrainerName: true,
        externalTrainerOrg: true,
        maxParticipants: true,
        status: true,
        program: { select: { programName: true, name: true, isStatutory: true, category: true } },
        plant: { select: { name: true } },
        trainer: { select: { name: true } },
        _count: { select: { registrations: true, sessions: true } }
      },
      orderBy: { startDate: "desc" },
      take: 200
    }),
    prisma.trainingSchedule.groupBy({ by: ["status"], _count: true })
  ]);
  const cnt = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  const rows: ScheduleRow[] = schedules.map((s) => ({
    id: s.id,
    scheduleNumber: s.scheduleNumber,
    programName: s.program.programName ?? s.program.name,
    isStatutory: s.program.isStatutory,
    plantName: s.plant.name,
    venue: s.venue,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    trainerLabel: s.isExternalTrainer
      ? `${s.externalTrainerName ?? "—"} (${s.externalTrainerOrg ?? "external"})`
      : s.trainer?.name ?? "—",
    registrationsCount: s._count.registrations,
    maxParticipants: s.maxParticipants,
    sessionsCount: s._count.sessions,
    status: s.status
  }));

  return (
    <div>
      <PageHeader
        title="Training Schedules"
        description="Plan, deliver, and track training sessions. Each schedule is one delivery instance of a program."
        breadcrumbs={[{ label: "Training", href: "/training" }, { label: "Schedules" }]}
        action={
          <Can permission="TRAINING.CREATE">
            <Button asChild>
              <Link href="/training/schedules/new">
                <Plus size={16} /> Schedule Training
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip href="/training/schedules?filter=all" active={filter === "all"} label="All" count={schedules.length} />
        <Chip href="/training/schedules?filter=draft" active={filter === "draft"} label="Draft" count={cnt("DRAFT")} tone="slate" />
        <Chip href="/training/schedules?filter=published" active={filter === "published"} label="Published" count={cnt("PUBLISHED")} tone="blue" />
        <Chip href="/training/schedules?filter=open" active={filter === "open"} label="Nominations open" count={cnt("NOMINATIONS_OPEN")} tone="violet" />
        <Chip href="/training/schedules?filter=active" active={filter === "active"} label="In progress" count={cnt("IN_PROGRESS")} tone="amber" />
        <Chip href="/training/schedules?filter=completed" active={filter === "completed"} label="Completed" count={cnt("COMPLETED")} tone="emerald" />
        <Chip href="/training/schedules?filter=cancelled" active={filter === "cancelled"} label="Cancelled" count={cnt("CANCELLED")} tone="rose" />
      </div>

      <SchedulesTable data={rows} />
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  count,
  tone = "primary"
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tone?: "primary" | "emerald" | "amber" | "blue" | "violet" | "rose" | "slate";
}) {
  const t: Record<string, string> = {
    primary: "bg-primary-600 text-white border-primary-600",
    emerald: "bg-emerald-600 text-white border-emerald-600",
    amber: "bg-amber-600 text-white border-amber-600",
    blue: "bg-blue-600 text-white border-blue-600",
    violet: "bg-violet-600 text-white border-violet-600",
    rose: "bg-rose-600 text-white border-rose-600",
    slate: "bg-slate-700 text-white border-slate-700"
  };
  return (
    <Link
      href={href}
      className={[
        "rounded-full border px-3 py-1 text-xs font-medium",
        active ? t[tone] : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
      ].join(" ")}
    >
      {label} <span className="opacity-70">({count})</span>
    </Link>
  );
}
