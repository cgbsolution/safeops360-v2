import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowTracker } from "@/components/workflow/workflow-tracker";
import { PARTY_INCLUDE, toParty } from "@/lib/workflow/party";
import { markRecordTasksRead } from "@/lib/workflow/read-state";
import { ApprovalPanel } from "@/components/workflow/approval-panel";
import { formatDateTime, formatNumber, humanize } from "@/lib/utils";
import { Lock, Unlock, Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function ManhoursDetailPage(
  props: {
    params: Promise<{ plantId: string; year: string; month: string }>;
  }
) {
  const params = await props.params;
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return notFound();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";

  // Try the legacy `Manhours` table first (existing detail flow).
  // If absent, check for a new `ManhoursSubmission` and bounce to
  // the wizard — which renders read-only for non-editable status.
  // This bridge keeps cell-clicks from the calendar grid working
  // for periods that only have new-style submissions.
  const record = await prisma.manhours.findUnique({
    where: { plantId_year_month: { plantId: params.plantId, year, month } },
    include: { plant: true }
  });
  if (!record) {
    const submission = await prisma.manhoursSubmission.findUnique({
      where: {
        plantId_reportingYear_reportingMonth: {
          plantId: params.plantId,
          reportingYear: year,
          reportingMonth: month
        }
      },
      select: { id: true }
    });
    if (submission) {
      redirect(`/manhours/${params.plantId}/${year}/${month}/edit`);
    }
    return notFound();
  }

  // When BOTH a legacy row and a new submission exist, we still
  // render the legacy detail (continuity) but surface the wizard
  // entry point so users can keep editing.
  const linkedSubmission = await prisma.manhoursSubmission.findUnique({
    where: {
      plantId_reportingYear_reportingMonth: {
        plantId: params.plantId,
        reportingYear: year,
        reportingMonth: month
      }
    },
    select: { id: true, status: true }
  });

  // Opening the record clears its Inbox unread state, however the viewer got
  // here. No-op unless they're the action owner.
  await markRecordTasksRead({ module: "MANHOURS", recordId: record.id, userId });

  const instance = await prisma.workflowInstance.findUnique({
    where: { module_recordId: { module: "MANHOURS", recordId: record.id } },
    include: {
      definition: { include: { steps: { orderBy: { sequence: "asc" } } } },
      history: { include: { performedBy: { include: PARTY_INCLUDE } }, orderBy: { performedAt: "asc" } },
      pendingTasks: { include: { assignedTo: { include: PARTY_INCLUDE } } }
    }
  });

  // Include OVERDUE/ESCALATED so an assignee can still act once a task
  // slips past its due date (mirrors the near-miss page).
  const OPEN_TASK_STATUSES = ["PENDING", "OVERDUE", "ESCALATED"];
  const myTask = instance?.pendingTasks.find((t) => t.assignedToId === userId && OPEN_TASK_STATUSES.includes(t.status));

  // Pull contributing incidents for the period — gives a reconciliation view
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const periodIncidents = await prisma.incident.findMany({
    where: { plantId: record.plantId, date: { gte: monthStart, lt: monthEnd } },
    orderBy: { date: "asc" },
    select: { id: true, number: true, date: true, type: true, lostDays: true, description: true }
  });

  const totalHours = record.employeeHours + record.contractorHours;

  return (
    <div>
      <PageHeader
        title={`${record.plant.name} · ${MONTHS[month]} ${year}`}
        description="Monthly manhours and computed safety performance indicators"
        breadcrumbs={[
          { label: "Manhours", href: "/manhours" },
          { label: `${MONTHS[month]} ${year}` }
        ]}
        action={
          <div className="flex items-center gap-2">
            <Badge className={record.locked ? "bg-slate-700 text-white" : "bg-amber-100 text-amber-800 border-amber-200"}>
              {record.locked ? <><Lock size={12} /> Locked</> : <><Unlock size={12} /> Open</>}
            </Badge>
            {linkedSubmission && (linkedSubmission.status === "DRAFT" || linkedSubmission.status === "UNLOCKED_FOR_REVISION") && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/manhours/${params.plantId}/${year}/${month}/edit`}>
                  <Pencil size={14} /> Edit in wizard
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {instance && (
        <div className="mb-4">
          <WorkflowTracker
            steps={instance.definition.steps.map((s) => ({
              id: s.id,
              sequence: s.sequence,
              stepType: s.stepType,
              name: s.name,
              approverRole: s.approverRole,
              approverField: s.approverField,
              slaHours: s.slaHours
            }))}
            history={instance.history.map((h) => ({
              id: h.id,
              stepId: h.stepId,
              stepName: h.stepName,
              action: h.action,
              performedAt: h.performedAt,
              comments: h.comments,
              performedBy: toParty(h.performedBy)
            }))}
            pendingTasks={instance.pendingTasks.map((t) => ({
              id: t.id,
              stepId: t.stepId,
              stepName: t.stepName,
              status: t.status,
              dueAt: t.dueAt,
              assignedTo: toParty(t.assignedTo)
            }))}
            currentStepId={instance.currentStepId}
            status={instance.status}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {myTask && myTask.taskType === "APPROVAL" && (
            <ApprovalPanel
              task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt, assignedAt: myTask.assignedAt }}
              recordData={{ plantId: record.plantId, year, month, ltiCount: record.ltiCount }}
            />
          )}

          <Card>
            <CardHeader><CardTitle>Manhours Worked</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Employee" value={formatNumber(record.employeeHours)} hint="hrs" />
                <Stat label="Contractor" value={formatNumber(record.contractorHours)} hint="hrs" />
                <Stat label="Total" value={formatNumber(totalHours)} hint="hrs" tone="primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Incident Counts (period)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                <Stat label="FAC" value={String(record.facCount)} hint="first aid" />
                <Stat label="MTC" value={String(record.mtcCount)} hint="medical" />
                <Stat label="RWC" value={String(record.rwcCount)} hint="restricted" />
                <Stat label="LTI" value={String(record.ltiCount)} hint="lost time" tone={record.ltiCount > 0 ? "danger" : "default"} />
                <Stat label="Fatality" value={String(record.fatalityCount)} hint="fatalities" tone={record.fatalityCount > 0 ? "danger" : "default"} />
                <Stat label="Lost Days" value={String(record.lostDays)} hint="days off" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Computed KPIs</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="LTIFR" value={Number(record.ltifr).toFixed(2)} hint="per million hrs" tone="primary" />
                <Stat label="TRIR" value={Number(record.trir).toFixed(2)} hint="per 200k hrs" tone="primary" />
                <Stat label="Severity Rate" value={Number(record.severityRate).toFixed(2)} hint="lost days / m hrs" tone="primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contributing Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              {periodIncidents.length === 0 ? (
                <p className="text-sm text-slate-500">No incidents recorded for this period.</p>
              ) : (
                <div className="space-y-2">
                  {periodIncidents.map((i) => (
                    <Link
                      key={i.id}
                      href={`/incidents/${i.id}`}
                      className="flex items-center justify-between gap-3 rounded border p-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs">{i.number}</div>
                        <div className="text-sm text-slate-700 truncate">{i.description.slice(0, 100)}</div>
                      </div>
                      <Badge>{humanize(i.type)}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Submission</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Period" value={`${MONTHS[month]} ${year}`} />
              <Row label="Plant" value={record.plant.name} />
              <Row label="Plant Code" value={record.plant.code} />
              <Row label="Submitted" value={formatDateTime(record.createdAt)} />
              <Row label="Updated" value={formatDateTime(record.updatedAt)} />
              <Row label="Status" value={record.locked ? "Locked" : "Open"} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "default" | "primary" | "danger" }) {
  const cls = tone === "danger" ? "text-rose-700" : tone === "primary" ? "text-primary-800" : "text-slate-900";
  return (
    <Card className="rounded border p-3 shadow-none">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${cls}`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-slate-500 whitespace-nowrap">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}
