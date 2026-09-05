"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, Inbox as InboxIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime, humanize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type InboxNotification = {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string | null;
};

const SEVERITY_CLS: Record<string, string> = {
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
  WARNING: "bg-amber-100 text-amber-800 border-amber-200",
  INFO: "bg-sky-100 text-sky-800 border-sky-200",
};

/**
 * The other half of the Inbox.
 *
 * The workflow tabs beside this one list TASKS — things with an assignee, a due
 * date and a state machine. Notifications are the events that have no task
 * attached but still need to reach a person: you are the lead auditor on
 * AUD-2026-014, a risk treatment is overdue, a trigger failed. They were being
 * written to the `Notification` table by CAMS / ERM / MOC and rendered nowhere
 * except one ERM-only widget, so in practice the email was the only channel
 * that worked. This is the in-app half the emails refer to.
 *
 * Read state is stamped on CLICK rather than on render, unlike the task tabs:
 * a notification's link often points outside the module (a CAPA, a programme
 * cycle), so "opened the record" is not something a single detail page can
 * report back here.
 */
export function NotificationList({ items }: { items: InboxNotification[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [read, setRead] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500">
        <InboxIcon size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm">No notifications — nothing has been assigned to you recently.</p>
      </div>
    );
  }

  async function open(n: InboxNotification) {
    if (!n.isRead && !read.has(n.id)) {
      setRead((prev) => new Set(prev).add(n.id));
      // Fire-and-forget: a failed read-stamp must not stop the navigation the
      // user actually asked for. The row simply stays bold until next load.
      fetch(`/api/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    }
    if (n.linkUrl) {
      startTransition(() => router.push(n.linkUrl!));
    } else {
      router.refresh();
    }
  }

  return (
    <div className="divide-y">
      {items.map((n) => {
        const unread = !n.isRead && !read.has(n.id);
        return (
          <Button variant="ghost"
            key={n.id}
            type="button"
            onClick={() => open(n)}
            className={cn(
              "block w-full border-l-[3px] px-5 py-4 text-left transition hover:bg-slate-50",
              unread ? "border-l-primary-600 bg-primary-50/40" : "border-l-transparent"
            )}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {unread && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-primary-600"
                  aria-label="Unread"
                  title="Unread"
                />
              )}
              <Badge className={cn("text-[10px]", SEVERITY_CLS[n.severity] ?? SEVERITY_CLS.INFO)}>
                {n.severity}
              </Badge>
              <Badge className="border-slate-200 bg-slate-100 text-[10px] text-slate-700">
                {humanize(n.type)}
              </Badge>
              {n.createdAt && (
                <span className="text-xs text-slate-400">{formatDateTime(n.createdAt)}</span>
              )}
              {unread && (
                <Badge className="border-primary-600 bg-primary-600 text-[10px] uppercase tracking-wide text-white">
                  New
                </Badge>
              )}
            </div>
            <div
              className={cn(
                "text-sm",
                unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"
              )}
            >
              {n.title}
            </div>
            {n.body && (
              <div className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-slate-500">
                {n.body}
              </div>
            )}
            {n.linkUrl && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-700">
                <Bell size={12} /> Open
              </div>
            )}
          </Button>
        );
      })}
    </div>
  );
}
