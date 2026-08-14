import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";

// Inbox read/unread state, mirroring the notification bell's contract.
//
// A task counts as READ once its assignee has actually looked at the record it
// points to. Deliberately keyed on *seeing the record*, not on clicking the
// Inbox row: a user who lands via a pasted deep link, a dashboard tile, a
// notification, or a modal has seen it just as much as one who came from the
// Inbox, and it would be maddening for the row to stay bold afterwards.
//
// Every module detail page calls markRecordTasksRead() on render, so there is
// exactly one place per module to get right.
//
// Both operations are backend-owned: the mark is scoped to `assignedToId == me`
// server-side, so no request shape lets one user clear another's queue.

/**
 * Mark every open task on `recordId` that is assigned to `userId` as read.
 *
 * The backend no-ops when the viewer holds no task on the record (the
 * overwhelmingly common case — most people opening a record are not its current
 * action owner), and its `readAt IS NULL` guard makes repeat renders a no-op
 * write rather than churning the timestamp on every page view.
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
    await backendFetch(
      `/api/workflow/mark-read/${encodeURIComponent(module)}/${encodeURIComponent(recordId)}`,
      { method: "POST", userId }
    );
  } catch {
    /* quiet — never block the page render on read-state bookkeeping */
  }
}

/**
 * As `markRecordTasksRead`, but resolves the viewer from the session itself.
 *
 * For detail pages that have no `userId` in scope — they shouldn't have to wire
 * up next-auth just to clear a bold row.
 */
export async function markRecordTasksReadForViewer(opts: {
  module: string;
  recordId: string;
}): Promise<void> {
  const session = await getServerSession(authOptions);
  await markRecordTasksRead({ ...opts, userId: (session?.user as any)?.id ?? null });
}

export interface UnreadInboxCounts {
  approvals: number;
  tasks: number;
  verifications: number;
  overdue: number;
  total: number;
}

/**
 * Unread counts for the Inbox tabs, by task type, plus an overdue-tab count.
 *
 * Read off `/api/workflow/my-count`, which computes these beside the tab
 * totals — so the pip and the number it sits on can never be derived from
 * two different definitions of "open".
 *
 * Degrades to zeros rather than throwing: an unread pip is decoration, and
 * losing it must not blank the Inbox.
 */
export async function unreadInboxCounts(userId: string): Promise<UnreadInboxCounts> {
  const zero: UnreadInboxCounts = {
    approvals: 0,
    tasks: 0,
    verifications: 0,
    overdue: 0,
    total: 0,
  };
  try {
    const c = await backendFetch<{
      unreadPendingApprovals: number;
      unreadMyTasks: number;
      unreadPendingVerification: number;
      unreadOverdueEscalated: number;
      unreadTotal: number;
    }>("/api/workflow/my-count", { userId });
    return {
      approvals: c.unreadPendingApprovals ?? 0,
      tasks: c.unreadMyTasks ?? 0,
      verifications: c.unreadPendingVerification ?? 0,
      overdue: c.unreadOverdueEscalated ?? 0,
      // Submitted-by-Me is excluded on purpose: those tasks belong to other
      // people, so "unread" is not the viewer's state to hold. The backend's
      // unreadTotal already leaves it out.
      total: c.unreadTotal ?? 0,
    };
  } catch {
    return zero;
  }
}
