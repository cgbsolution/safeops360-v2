import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Inbox read/unread state, mirroring the notification bell's contract.
//
// A task counts as READ once its assignee has actually looked at the record it
// points to. Deliberately keyed on *seeing the record*, not on clicking the
// Inbox row: a user who lands via a pasted deep link, a dashboard tile, a
// notification, or a modal has seen it just as much as one who came from the
// Inbox, and it would be maddening for the row to stay bold afterwards.
//
// Every module detail page calls markRecordTasksRead() on render, so there is
// exactly one place per module to get right, and no client round-trip.

/** Statuses that still belong in an inbox — terminal tasks are never "unread". */
const OPEN_TASK_STATUSES = ["PENDING", "OVERDUE", "ESCALATED"];

/**
 * Mark every open task on `recordId` that is assigned to `userId` as read.
 *
 * No-ops when the viewer has no task on the record (the overwhelmingly common
 * case — most people opening a record are not its current action owner), and
 * the `readAt: null` guard makes repeat renders a no-op write rather than
 * churning the timestamp on every page view.
 *
 * Never throws: read-state is a UI nicety, and a failure here must not take
 * down the record page the user actually asked for.
 */
export async function markRecordTasksRead(opts: {
  module: string;
  recordId: string;
  userId: string | null | undefined;
}): Promise<void> {
  const { module, recordId, userId } = opts;
  if (!userId || !recordId) return;
  try {
    await prisma.workflowTask.updateMany({
      where: {
        module,
        recordId,
        assignedToId: userId,
        status: { in: OPEN_TASK_STATUSES },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  } catch {
    /* quiet — never block the page render on read-state bookkeeping */
  }
}

/**
 * As `markRecordTasksRead`, but resolves the viewer from the session itself.
 *
 * For detail pages that read through the FastAPI backend rather than Prisma
 * (CAPA / MOC / HIRA) and so have no `userId` in scope — they shouldn't have to
 * wire up next-auth just to clear a bold row.
 */
export async function markRecordTasksReadForViewer(opts: {
  module: string;
  recordId: string;
}): Promise<void> {
  const session = await getServerSession(authOptions);
  await markRecordTasksRead({ ...opts, userId: (session?.user as any)?.id ?? null });
}

/**
 * Unread counts for the Inbox tabs, by taskType, plus an overdue-tab count.
 *
 * Kept as one groupBy + one count so adding the unread indicators costs two
 * queries, not one per tab.
 */
export async function unreadInboxCounts(userId: string): Promise<{
  approvals: number;
  tasks: number;
  verifications: number;
  overdue: number;
  total: number;
}> {
  const [byType, overdue] = await Promise.all([
    prisma.workflowTask.groupBy({
      by: ["taskType"],
      where: {
        assignedToId: userId,
        status: { in: OPEN_TASK_STATUSES },
        readAt: null,
      },
      _count: { _all: true },
    }),
    prisma.workflowTask.count({
      where: {
        assignedToId: userId,
        status: { in: ["OVERDUE", "ESCALATED"] },
        readAt: null,
      },
    }),
  ]);

  const of = (t: string) => byType.find((r) => r.taskType === t)?._count._all ?? 0;
  const approvals = of("APPROVAL");
  const tasks = of("EXECUTION");
  const verifications = of("VERIFICATION");
  return {
    approvals,
    tasks,
    verifications,
    overdue,
    // Submitted-by-Me is excluded on purpose: those tasks belong to other
    // people, so "unread" is not the viewer's state to hold.
    total: approvals + tasks + verifications,
  };
}
