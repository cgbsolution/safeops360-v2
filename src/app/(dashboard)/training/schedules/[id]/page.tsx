import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Eye,
  GraduationCap,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react";
import { markRecordTasksRead } from "@/lib/workflow/read-state";
import { ScheduleLifecyclePanel } from "@/components/training/schedule-lifecycle-panel";
import { ScheduleSessionsBlock } from "@/components/training/schedule-sessions-block";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PUBLISHED: "bg-blue-100 text-blue-800 border-blue-200",
  NOMINATIONS_OPEN: "bg-violet-100 text-violet-800 border-violet-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
};

const REG_STATUS_BADGE: Record<string, string> = {
  REGISTERED: "bg-slate-100 text-slate-700 border-slate-200",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  ATTENDED: "bg-violet-100 text-violet-800 border-violet-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FAILED: "bg-rose-100 text-rose-700 border-rose-200",
  NO_SHOW: "bg-rose-100 text-rose-700 border-rose-200",
  CANCELLED: "bg-slate-200 text-slate-500 border-slate-300",
  WITHDREW: "bg-slate-200 text-slate-500 border-slate-300",
};

export default async function TrainingScheduleDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "";

  const schedule = await prisma.trainingSchedule.findUnique({
    where: { id: params.id },
    include: {
      program: {
        select: {
          id: true,
          programCode: true,
          code: true,
          programName: true,
          name: true,
          category: true,
          isStatutory: true,
          hasAssessment: true,
          passingScorePercent: true,
          passingScore: true,
        },
      },
      plant: { select: { name: true } },
      trainer: { select: { name: true } },
      createdBy: { select: { name: true } },
      sessions: { orderBy: { sequence: "asc" } },
      registrations: {
        include: {
          user: { select: { id: true, name: true, designation: true } },
        },
        orderBy: { registeredAt: "asc" },
      },
    },
  });
  if (!schedule) return notFound();

  // Opening the record clears its Inbox unread state, however the viewer got
  // here. TRAINING workflow tasks key off the schedule id, so this is the page
  // that owns that read state. No-op unless they're the action owner.
  await markRecordTasksRead({
    module: "TRAINING",
    recordId: schedule.id,
    userId: (session?.user as any)?.id ?? null
  });

  const presentRegIds = new Set(
    schedule.registrations
      .filter((r) => ["ATTENDED", "COMPLETED"].includes(r.status))
      .map((r) => r.id)
  );
  const passedCount = schedule.registrations.filter((r) => r.passed === true).length;
  const failedCount = schedule.registrations.filter((r) => r.passed === false).length;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={schedule.scheduleNumber}
        description={`${schedule.program.programName ?? schedule.program.name}`}
        breadcrumbs={[
          { label: "Training", href: "/training" },
          { label: "Schedules", href: "/training/schedules" },
          { label: schedule.scheduleNumber },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Badge className={STATUS_BADGE[schedule.status] ?? ""}>
              {schedule.status.replace(/_/g, " ")}
            </Badge>
            {schedule.program.isStatutory && (
              <Badge className="bg-rose-100 text-rose-800 border-rose-200">
                <ShieldAlert size={11} /> Statutory
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <ScheduleLifecyclePanel
            scheduleId={schedule.id}
            status={schedule.status}
            currentRole={role}
          />

          <ScheduleSessionsBlock
            scheduleId={schedule.id}
            sessions={schedule.sessions.map((s) => ({
              id: s.id,
              sequence: s.sequence,
              title: s.title,
              startTime: s.startTime.toISOString(),
              endTime: s.endTime.toISOString(),
              conductedAt: s.conductedAt ? s.conductedAt.toISOString() : null,
            }))}
            roster={schedule.registrations
              .filter((r) => r.approvalStatus === "APPROVED" && r.status !== "CANCELLED")
              .map((r) => ({
                registrationId: r.id,
                userId: r.userId,
                userName: r.user.name,
                userDesignation: r.user.designation,
              }))}
            scheduleStatus={schedule.status}
            currentRole={role}
            isAssignedTrainer={schedule.trainerId === (session?.user as any)?.id}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserIcon size={16} /> Registrations ({schedule.registrations.length})
              </CardTitle>
              <CardDescription className="text-xs">
                {schedule.registrations.filter((r) => r.approvalStatus === "PENDING").length} pending
                approval · {presentRegIds.size} attended · {passedCount} passed · {failedCount} failed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {schedule.registrations.length === 0 ? (
                <div className="text-xs text-slate-500">No registrations yet.</div>
              ) : (
                schedule.registrations.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs"
                  >
                    <div>
                      <div className="font-medium">{r.user.name}</div>
                      <div className="text-slate-500 flex items-center gap-2">
                        {r.user.designation ?? "—"} ·{" "}
                        <span className="font-mono">{r.registrationType}</span>
                        {r.assessmentScore !== null && (
                          <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                            {r.assessmentScore}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <Badge className={REG_STATUS_BADGE[r.status] ?? ""}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                      {r.approvalStatus === "PENDING" && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                          approval pending
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <GraduationCap size={14} /> Program
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1.5">
              <Link
                href={`/training/programs/${schedule.program.id}`}
                className="text-primary-700 hover:text-primary-900 font-medium block"
              >
                {schedule.program.programName ?? schedule.program.name}
              </Link>
              <div className="text-slate-500 font-mono">
                {schedule.program.programCode ?? schedule.program.code}
              </div>
              {schedule.program.category && (
                <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                  {schedule.program.category}
                </Badge>
              )}
              {schedule.program.hasAssessment && (
                <div className="text-slate-600 mt-2">
                  Assessment required ·{" "}
                  {schedule.program.passingScorePercent ?? schedule.program.passingScore}% passing
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <CalendarDays size={14} /> When & Where
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1.5">
              <Row label="Start" value={formatDate(schedule.startDate)} />
              <Row label="End" value={formatDate(schedule.endDate)} />
              <Row label="Plant" value={schedule.plant.name} />
              <Row label="Venue" value={schedule.venue} />
              <Row label="Language" value={schedule.language} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Trainer</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1.5">
              {schedule.isExternalTrainer ? (
                <>
                  <Row label="Name" value={schedule.externalTrainerName ?? "—"} />
                  <Row label="Org" value={schedule.externalTrainerOrg ?? "—"} />
                  <Row label="Cert" value={schedule.externalTrainerCert ?? "—"} />
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                    External
                  </Badge>
                </>
              ) : (
                <Row label="Trainer" value={schedule.trainer?.name ?? "—"} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Created</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <Row label="By" value={schedule.createdBy.name} />
              <Row label="At" value={formatDateTime(schedule.createdAt)} />
              {schedule.publishedAt && (
                <Row label="Published" value={formatDateTime(schedule.publishedAt)} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-1 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right break-words">{value}</span>
    </div>
  );
}
