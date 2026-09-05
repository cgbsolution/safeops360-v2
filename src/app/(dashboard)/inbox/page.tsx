import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, AlertTriangle, Eye, FileCheck, Hourglass, Inbox as InboxIcon, Send } from "lucide-react";
import { formatDateTime, humanize, cn } from "@/lib/utils";
import { toParty } from "@/lib/workflow/party";
import { unreadInboxCounts } from "@/lib/workflow/read-state";
import { MarkAllReadButton } from "./mark-all-read";
import { NotificationList, type InboxNotification } from "./notification-list";
import { formatPartyMeta, formatPartyName } from "@/lib/users/user-ref";

export const dynamic = "force-dynamic";

// Queue ordering. The work tabs are a *feed*: whatever just landed in your
// inbox is what you're most likely looking for, so newest-assigned wins and
// lateness is communicated by the SLA chip rather than by re-ranking the list.
// Row ordering lives server-side now (see _tab_order_by in
// app/routers/workflow.py): every tab is newest-assigned first EXCEPT Overdue /
// Escalated, where "how long has this been sitting past due" IS the sort key,
// so the oldest due date leads.

const TABS = [
  { key: "approvals", label: "Pending Approvals", icon: FileCheck },
  { key: "tasks", label: "My Tasks", icon: Hourglass },
  { key: "verifications", label: "Pending Verification", icon: CheckCircle2 },
  // Events with no workflow task behind them — audit assignments, risk-owner
  // handovers, overdue treatments. They were being written to the backend
  // Notification table and shown nowhere, so email was the only channel that
  // actually reached anyone. See ./notification-list.tsx.
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "submitted", label: "Submitted by Me", icon: Send },
  { key: "overdue", label: "Overdue / Escalated", icon: AlertTriangle }
] as const;

/**
 * The backend notification feed. Returns an empty list rather than throwing:
 * this is one tab of six, and a backend hiccup must not 500 the whole Inbox.
 */
async function loadNotifications(): Promise<InboxNotification[]> {
  try {
    const res = await backendFetch<{ notifications: InboxNotification[] }>(
      "/api/notifications",
      { query: { limit: 100 } }
    );
    return res?.notifications ?? [];
  } catch (e) {
    console.error("Inbox notifications fetch failed:", e);
    return [];
  }
}

async function loadUnreadNotificationCount(): Promise<number> {
  try {
    const res = await backendFetch<{ count: number }>("/api/notifications/unread-count");
    return res?.count ?? 0;
  } catch {
    return 0;
  }
}

// Every module the workflow engine mints tasks for MUST appear here. A module
// missing from these maps renders a blank badge and links to /dashboard instead
// of the record — the row becomes a dead end, and (since read state is stamped
// by opening the record) it can never be marked read either. CAPA / MOC /
// HIRA_STUDY were missing, stranding a large share of the queue.
const MODULE_HREF: Record<string, string> = {
  OBSERVATION: "/observations",
  NEAR_MISS: "/near-miss",
  PTW: "/ptw",
  INCIDENT: "/incidents",
  // TRAINING tasks carry a TrainingSchedule id, NOT a TrainingRecord id —
  // verified against the live table. "/training/{id}" is the record route, so
  // every training row in the inbox 404'd. Schedules is the correct target.
  TRAINING: "/training/schedules",
  INSPECTION: "/inspections",
  MANHOURS: "/manhours",
  CAPA: "/capa",
  MOC: "/moc",
  HIRA_STUDY: "/hira"
};

const MODULE_LABEL: Record<string, string> = {
  OBSERVATION: "Observation",
  NEAR_MISS: "Near Miss",
  PTW: "Permit",
  INCIDENT: "Incident",
  TRAINING: "Training",
  INSPECTION: "Inspection",
  MANHOURS: "Manhours",
  CAPA: "CAPA",
  MOC: "MOC",
  HIRA_STUDY: "HIRA"
};

export default async function InboxPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any).id;
  const tab = (searchParams.tab ?? "approvals") as (typeof TABS)[number]["key"];

  // The SLA sweeps (task overdue/escalation, permit expiry, inspection status)
  // used to run here, throttled, as a side effect of somebody opening the
  // Inbox — so on a quiet day an approval could sit past its SLA and a permit
  // past its validTo indefinitely. They are scheduler jobs on the backend now
  // (workflow_overdue_sweep / ptw_expiry_scan / inspection_status_sweep), which
  // means the clock runs whether or not anyone is looking.

  // Fetch badge counts. Overdue is a SEPARATE count restricted to
  // OVERDUE/ESCALATED status — the previous code summed all PENDING
  // tasks too, which made the badge show "2" even when nothing was
  // actually overdue.
  const [myCount, unread, unreadNotifications] = await Promise.all([
    // One call covers every tab total. `overdueStrict` is deliberately the
    // narrow definition — tasks whose status IS OVERDUE/ESCALATED — because the
    // broad one (anything past dueAt, or flagged URGENT) made this badge read
    // "overdue" while nothing had actually breached.
    backendFetch<{
      tabPendingApprovals: number;
      tabMyTasks: number;
      tabPendingVerification: number;
      overdueStrict: number;
      submittedInstances: number;
    }>("/api/workflow/my-count", { userId }).catch(() => ({
      tabPendingApprovals: 0,
      tabMyTasks: 0,
      tabPendingVerification: 0,
      overdueStrict: 0,
      submittedInstances: 0
    })),
    unreadInboxCounts(userId),
    loadUnreadNotificationCount()
  ]);

  const approvalCount = myCount.tabPendingApprovals;
  const taskCount = myCount.tabMyTasks;
  const verificationCount = myCount.tabPendingVerification;
  const overdueCount = myCount.overdueStrict;
  const submittedCount = myCount.submittedInstances;

  const counts = {
    approvals: approvalCount,
    tasks: taskCount,
    verifications: verificationCount,
    // The tab badge counts UNREAD here, not total. A notification feed has no
    // "open" state to count — every notification ever sent is still in it — so
    // a total would be a number that only grows and means nothing.
    notifications: unreadNotifications,
    submitted: submittedCount,
    overdue: overdueCount
  };

  // Unread = the assignee has never opened the record. "Submitted by Me" has no
  // unread state: those tasks belong to other people.
  const unreadByTab: Record<(typeof TABS)[number]["key"], number> = {
    approvals: unread.approvals,
    tasks: unread.tasks,
    verifications: unread.verifications,
    // The count badge on this tab is ALREADY the unread number, so a rose pip
    // beside it would say the same thing twice.
    notifications: 0,
    submitted: 0,
    overdue: unread.overdue
  };

  // Only fetch the full rows for the active tab — avoids 5 concurrent queries
  let pendingApprovals: any[] = [];
  let executionTasks: any[] = [];
  let verifications: any[] = [];
  let submitted: any[] = [];
  let overdue: any[] = [];
  let notifications: InboxNotification[] = [];

  // Only the active tab's rows are fetched. Each maps to a server-side tab
  // filter, so "open" means the same thing here as it does in the badge above.
  const loadTab = (t: string) =>
    backendFetch<{ items: any[] }>("/api/workflow/tasks", {
      userId,
      query: { tab: t, limit: 50 }
    })
      .then((r) => r.items)
      .catch(() => [] as any[]);

  if (tab === "notifications") {
    notifications = await loadNotifications();
  } else if (tab === "approvals") {
    pendingApprovals = await loadTab("pending_approvals");
  } else if (tab === "tasks") {
    executionTasks = await loadTab("my_tasks");
  } else if (tab === "verifications") {
    verifications = await loadTab("pending_verification");
  } else if (tab === "submitted") {
    // Instances, not tasks: one submission with three approvers is ONE row
    // here. /tasks?tab=submitted_by_me would return three.
    submitted = await backendFetch<{ items: any[] }>("/api/workflow/submitted", {
      userId,
      query: { limit: 50 }
    })
      .then((r) => r.items)
      .catch(() => [] as any[]);
  } else if (tab === "overdue") {
    overdue = await loadTab("overdue_escalated");
  }

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Your action queue across every SafeOps360 workflow"
        action={
          <div className="flex items-center gap-2">
            {unread.total > 0 && (
              <>
                <Badge className="bg-rose-600 text-white border-rose-600">{unread.total} unread</Badge>
                <MarkAllReadButton />
              </>
            )}
            <Badge className="bg-primary-100 text-primary-800 border-primary-200">
              {counts.approvals + counts.tasks + counts.verifications} active
            </Badge>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const c = counts[t.key];
          const u = unreadByTab[t.key];
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/inbox?tab=${t.key}`}
              // The count badge keeps its meaning (open items). Unread is a
              // SEPARATE signal — a rose pip — so a tab can't be misread as
              // "5 unread" when it means "5 items, 2 of them new".
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition",
                active
                  ? "bg-primary-700 text-white border-primary-700"
                  : "bg-white text-slate-700 border-slate-300 hover:border-primary-400"
              )}
              title={u > 0 ? `${u} not opened yet` : undefined}
            >
              <Icon size={14} />
              {t.label}
              <span className={cn("ml-1 px-1.5 rounded text-xs", active ? "bg-white/20" : c > 0 ? "bg-primary-100 text-primary-800" : "bg-slate-100 text-slate-500")}>
                {c}
              </span>
              {u > 0 && (
                <Badge variant="danger" className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-4 text-white">
                  {u > 99 ? "99+" : u}
                </Badge>
              )}
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
          {tab === "notifications" && <NotificationList items={notifications} />}
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
        // Unread = never opened. Same visual language as the notification bell:
        // tinted row + left accent + bolder title, cleared by opening the record.
        const unread = !task.readAt;
        return (
          <Link
            key={task.id}
            href={recordHref}
            className={cn(
              "block border-l-[3px] px-5 py-4 transition hover:bg-slate-50",
              unread ? "border-l-primary-600 bg-primary-50/40" : "border-l-transparent",
              overdueMode && (unread ? "bg-rose-50" : "bg-rose-50/50")
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {unread && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-primary-600"
                      aria-label="Not opened yet"
                      title="Not opened yet"
                    />
                  )}
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                    {MODULE_LABEL[task.module] ?? humanize(task.module)}
                  </Badge>
                  <span className="font-mono text-xs text-slate-600">{task.recordNumber ?? task.recordId.slice(0, 8)}</span>
                  <Badge className={slaInfo.cls + " text-[10px]"}>{slaInfo.label}</Badge>
                  {task.priority !== "NORMAL" && (
                    <Badge className={priorityCls(task.priority) + " text-[10px]"}>{task.priority}</Badge>
                  )}
                  {unread && (
                    <Badge className="bg-primary-600 text-white border-primary-600 text-[10px] uppercase tracking-wide">New</Badge>
                  )}
                </div>
                <div className={cn("text-sm", unread ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>
                  {task.stepName}
                </div>
                {task.recordTitle && (
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.recordTitle}</div>
                )}
                {(() => {
                  // Same identity contract as the "Awaiting Action" callout:
                  // full name plus designation / role / department / plant, so
                  // a task from "Process Operator" is attributable to a person.
                  // /api/workflow/tasks returns the initiator flattened onto the task
                  // rather than nested under instance.initiatedBy.
                  const initiator = toParty(
                    task.initiatedByName
                      ? {
                          name: task.initiatedByName,
                          designation: task.initiatedByDesignation,
                          role: task.initiatedByRole,
                          department: task.initiatedByDepartment,
                          plant: task.initiatedByPlantName
                            ? { name: task.initiatedByPlantName }
                            : null
                        }
                      : null
                  );
                  const meta = formatPartyMeta(initiator);
                  return (
                    <div className="text-xs text-slate-500 mt-1">
                      Initiated by <strong>{formatPartyName(initiator)}</strong>
                      {meta && <> <span className="text-slate-400">({meta})</span></>}
                      {task.assignedAt && <> · Received {formatDateTime(task.assignedAt)}</>}
                      {task.dueAt && <> · Due {formatDateTime(task.dueAt)}</>}
                    </div>
                  );
                })()}
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
