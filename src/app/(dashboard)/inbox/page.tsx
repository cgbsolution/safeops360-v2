import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Eye, FileCheck, Hourglass, Inbox as InboxIcon, Send } from "lucide-react";
import { formatDateTime, humanize, cn } from "@/lib/utils";
import { WorkflowEngine } from "@/lib/workflow/engine";

export const dynamic = "force-dynamic";

// Throttle the SLA sweeps. Without this the three sweeps run on every
// inbox navigation — costing ~500-1000ms per click even when nothing is
// overdue. Module-level state survives across requests in the same Node
// process; resets on dev-server restart.
const SWEEP_INTERVAL_MS = 5 * 60_000;
let _lastSweepAt = 0;
function shouldRunSweeps(): boolean {
  const now = Date.now();
  if (now - _lastSweepAt < SWEEP_INTERVAL_MS) return false;
  _lastSweepAt = now;
  return true;
}

const TABS = [
  { key: "approvals", label: "Pending Approvals", icon: FileCheck },
  { key: "tasks", label: "My Tasks", icon: Hourglass },
  { key: "verifications", label: "Pending Verification", icon: CheckCircle2 },
  { key: "submitted", label: "Submitted by Me", icon: Send },
  { key: "overdue", label: "Overdue / Escalated", icon: AlertTriangle }
] as const;

const MODULE_HREF: Record<string, string> = {
  OBSERVATION: "/observations",
  NEAR_MISS: "/near-miss",
  PTW: "/ptw",
  INCIDENT: "/incidents",
  TRAINING: "/training",
  INSPECTION: "/inspections",
  MANHOURS: "/manhours"
};

const MODULE_LABEL: Record<string, string> = {
  OBSERVATION: "Observation",
  NEAR_MISS: "Near Miss",
  PTW: "Permit",
  INCIDENT: "Incident",
  TRAINING: "Training",
  INSPECTION: "Inspection",
  MANHOURS: "Manhours"
};

export default async function InboxPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any).id;
  const tab = (searchParams.tab ?? "approvals") as (typeof TABS)[number]["key"];

  // Lazy SLA sweep: flip PENDING → OVERDUE and OVERDUE → ESCALATED before showing
  // counts. Idempotent — but expensive enough that running it on every inbox
  // navigation hurts perceived latency. Throttle to once per 5 minutes per
  // process so users get fast page loads while overdue detection still
  // happens often enough for the demo timeline.
  try {
    if (shouldRunSweeps()) {
      await Promise.all([
        WorkflowEngine.sweepOverdue(),
        WorkflowEngine.sweepExpiredPermits(),
        WorkflowEngine.sweepInspectionStatus()
      ]);
    }
  } catch (e) {
    console.error("Inbox sweeps failed:", e);
  }

  // Fetch badge counts. Overdue is a SEPARATE count restricted to
  // OVERDUE/ESCALATED status — the previous code summed all PENDING
  // tasks too, which made the badge show "2" even when nothing was
  // actually overdue.
  const [taskCounts, submittedCount, overdueRealCount] = await Promise.all([
    prisma.workflowTask.groupBy({
      by: ["taskType"],
      where: { assignedToId: userId, status: { in: ["PENDING", "OVERDUE", "ESCALATED"] } },
      _count: { _all: true }
    }),
    prisma.workflowInstance.count({ where: { initiatedById: userId } }),
    prisma.workflowTask.count({
      where: { assignedToId: userId, status: { in: ["OVERDUE", "ESCALATED"] } }
    })
  ]);

  const approvalCount = taskCounts.find((r) => r.taskType === "APPROVAL")?._count._all ?? 0;
  const taskCount = taskCounts.find((r) => r.taskType === "EXECUTION")?._count._all ?? 0;
  const verificationCount = taskCounts.find((r) => r.taskType === "VERIFICATION")?._count._all ?? 0;
  const overdueCount = overdueRealCount;

  const counts = {
    approvals: approvalCount,
    tasks: taskCount,
    verifications: verificationCount,
    submitted: submittedCount,
    overdue: overdueCount
  };

  // Only fetch the full rows for the active tab — avoids 5 concurrent queries
  let pendingApprovals: any[] = [];
  let executionTasks: any[] = [];
  let verifications: any[] = [];
  let submitted: any[] = [];
  let overdue: any[] = [];

  if (tab === "approvals") {
    pendingApprovals = await prisma.workflowTask.findMany({
      where: { assignedToId: userId, taskType: "APPROVAL", status: { in: ["PENDING", "OVERDUE", "ESCALATED"] } },
      include: { instance: { include: { initiatedBy: true } } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }]
    });
  } else if (tab === "tasks") {
    executionTasks = await prisma.workflowTask.findMany({
      where: { assignedToId: userId, taskType: "EXECUTION", status: { in: ["PENDING", "OVERDUE", "ESCALATED"] } },
      include: { instance: { include: { initiatedBy: true } } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }]
    });
  } else if (tab === "verifications") {
    verifications = await prisma.workflowTask.findMany({
      where: { assignedToId: userId, taskType: "VERIFICATION", status: { in: ["PENDING", "OVERDUE", "ESCALATED"] } },
      include: { instance: { include: { initiatedBy: true } } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }]
    });
  } else if (tab === "submitted") {
    submitted = await prisma.workflowInstance.findMany({
      where: { initiatedById: userId },
      orderBy: { initiatedAt: "desc" },
      take: 50
    });
  } else if (tab === "overdue") {
    overdue = await prisma.workflowTask.findMany({
      where: { assignedToId: userId, status: { in: ["OVERDUE", "ESCALATED"] } },
      include: { instance: true },
      orderBy: { dueAt: "asc" }
    });
  }

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Your action queue across every SafeOps360 workflow"
        action={<Badge className="bg-primary-100 text-primary-800 border-primary-200">{counts.approvals + counts.tasks + counts.verifications} active</Badge>}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const c = counts[t.key];
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/inbox?tab=${t.key}`}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition",
                active
                  ? "bg-primary-700 text-white border-primary-700"
                  : "bg-white text-slate-700 border-slate-300 hover:border-primary-400"
              )}
            >
              <Icon size={14} />
              {t.label}
              <span className={cn("ml-1 px-1.5 rounded text-xs", active ? "bg-white/20" : c > 0 ? "bg-primary-100 text-primary-800" : "bg-slate-100 text-slate-500")}>
                {c}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-0">
          {tab === "approvals" && <TaskList tasks={pendingApprovals} actionLabel="Approve" emptyText="No pending approvals — you're all caught up." />}
          {tab === "tasks" && <TaskList tasks={executionTasks} actionLabel="Execute" emptyText="No execution tasks assigned to you." />}
          {tab === "verifications" && <TaskList tasks={verifications} actionLabel="Verify" emptyText="No items awaiting your verification." />}
          {tab === "submitted" && <SubmittedList items={submitted} />}
          {tab === "overdue" && <TaskList tasks={overdue} actionLabel="Open" emptyText="🎉 Nothing overdue. Keep it up." overdueMode />}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskList({ tasks, actionLabel, emptyText, overdueMode }: { tasks: any[]; actionLabel: string; emptyText: string; overdueMode?: boolean }) {
  if (tasks.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500">
        <InboxIcon size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="divide-y">
      {tasks.map((task) => {
        const slaInfo = computeSla(task.dueAt);
        const moduleHref = MODULE_HREF[task.module] ?? "/dashboard";
        const recordHref = `${moduleHref}/${task.recordId}`;
        return (
          <Link
            key={task.id}
            href={recordHref}
            className={cn(
              "block px-5 py-4 hover:bg-slate-50 transition",
              overdueMode && "bg-rose-50/50"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">{MODULE_LABEL[task.module]}</Badge>
                  <span className="font-mono text-xs text-slate-600">{task.recordNumber ?? task.recordId.slice(0, 8)}</span>
                  <Badge className={slaInfo.cls + " text-[10px]"}>{slaInfo.label}</Badge>
                  {task.priority !== "NORMAL" && (
                    <Badge className={priorityCls(task.priority) + " text-[10px]"}>{task.priority}</Badge>
                  )}
                </div>
                <div className="text-sm font-medium text-slate-900">{task.stepName}</div>
                {task.recordTitle && (
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.recordTitle}</div>
                )}
                <div className="text-xs text-slate-500 mt-1">
                  Initiated by <strong>{task.instance?.initiatedBy?.name ?? "—"}</strong>
                  {task.assignedAt && <> · Received {formatDateTime(task.assignedAt)}</>}
                  {task.dueAt && <> · Due {formatDateTime(task.dueAt)}</>}
                </div>
              </div>
              <div className="flex-shrink-0 self-center">
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-700">
                  <Eye size={14} /> {actionLabel}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SubmittedList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500">
        <Send size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm">You haven't submitted any records yet.</p>
      </div>
    );
  }
  return (
    <div className="divide-y">
      {items.map((inst) => {
        const moduleHref = MODULE_HREF[inst.module] ?? "/dashboard";
        const isRejected = inst.status === "REJECTED";
        return (
          <Link
            key={inst.id}
            href={`${moduleHref}/${inst.recordId}`}
            className={cn(
              "block px-5 py-4 hover:bg-slate-50",
              isRejected && "bg-rose-50/50 hover:bg-rose-50"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">{MODULE_LABEL[inst.module]}</Badge>
                  <span className="font-mono text-xs text-slate-600">{inst.recordNumber ?? inst.recordId.slice(0, 8)}</span>
                  <Badge className={statusCls(inst.status) + " text-[10px]"}>{humanize(inst.status)}</Badge>
                  {isRejected && (
                    <Badge className="bg-rose-600 text-white border-rose-600 text-[10px] uppercase">Action: Re-submit</Badge>
                  )}
                </div>
                <div className="text-sm font-medium text-slate-900">{inst.currentStepName ?? "—"}</div>
                <div className="text-xs text-slate-500">Submitted {formatDateTime(inst.initiatedAt)}</div>
              </div>
              <Eye size={14} className="text-slate-400" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function computeSla(dueAt: Date | null) {
  if (!dueAt) return { label: "No SLA", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  const hoursLeft = (new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft < 0) return { label: `Overdue ${Math.abs(Math.round(hoursLeft))}h`, cls: "bg-rose-100 text-rose-700 border-rose-200" };
  if (hoursLeft < 24) return { label: `${Math.round(hoursLeft)}h left`, cls: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: `${Math.round(hoursLeft / 24)}d left`, cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
}

function priorityCls(p: string) {
  if (p === "URGENT") return "bg-rose-600 text-white border-rose-600";
  if (p === "HIGH") return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function statusCls(s: string) {
  if (s === "COMPLETED") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "REJECTED") return "bg-rose-100 text-rose-800 border-rose-200";
  if (s === "IN_PROGRESS") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}
