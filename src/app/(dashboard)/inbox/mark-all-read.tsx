"use client";

// "Mark all read" for the Inbox — the escape hatch for a backlog nobody is
// going to open one by one (notably the first load after the read-state column
// ships, when every existing task is unread by definition).
//
// Mirrors the notification bell's control: quiet, inline, and it refreshes the
// server component rather than mutating local state, so the tab pips, the row
// styling and the header count all move together.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/inbox/read-all", { method: "POST" });
    } catch {
      /* quiet — worst case the rows stay bold and the user can retry */
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-primary-400 hover:text-primary-700 disabled:opacity-50"
    >
      <CheckCheck size={13} />
      {busy || pending ? "Marking…" : "Mark all read"}
    </button>
  );
}
