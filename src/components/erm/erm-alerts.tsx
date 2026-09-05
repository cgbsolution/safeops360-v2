"use client";

// Notifications / alerts bell for the ERM dashboard header.
// Self-contained + defensive: fetches its own unread count and recent
// notifications via the catch-all proxy (fetch("/api/notifications...")),
// which handles auth. Degrades quietly on any fetch failure.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Severity = "INFO" | "WARNING" | "CRITICAL";

type Notification = {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

const SEVERITY_DOT: Record<Severity, string> = {
  INFO: "bg-slate-400",
  WARNING: "bg-amber-500",
  CRITICAL: "bg-rose-500",
};

const SEVERITY_ACCENT: Record<Severity, string> = {
  INFO: "border-l-slate-300",
  WARNING: "border-l-amber-400",
  CRITICAL: "border-l-rose-500",
};

function shortTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const diff = Date.now() - then;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

export function ErmAlerts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const loadCount = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications/unread-count");
      if (!r.ok) return;
      const d = await r.json();
      if (typeof d?.count === "number") setCount(d.count);
    } catch {
      /* quiet */
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications?limit=15");
      if (!r.ok) {
        setItems([]);
        return;
      }
      const d = await r.json();
      setItems(Array.isArray(d) ? (d as Notification[]) : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void loadItems();
  }

  async function markAllRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      /* quiet */
    }
    await Promise.all([loadItems(), loadCount()]);
  }

  async function openItem(n: Notification) {
    if (!n.isRead) {
      try {
        await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
      } catch {
        /* quiet */
      }
      void loadCount();
    }
    setOpen(false);
    if (n.linkUrl) router.push(n.linkUrl);
  }

  const badge = count > 99 ? "99+" : String(count);

  return (
    <div ref={wrapRef} className="relative">
      <Button variant="outline"
        type="button"
        onClick={toggle}
        aria-label={`Alerts${count > 0 ? ` (${count} unread)` : ""}`} className="relative h-9 w-9 rounded-lg transition-colors">
        <Bell size={18} />
        {count > 0 && (
          <Badge variant="danger" className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-4 text-white">
            {badge}
          </Badge>
        )}
      </Button>

      {open && (
        <Card className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-800">Alerts</span>
            {count > 0 && (
              <Button variant="link"
                type="button"
                onClick={markAllRead} className="text-[11px] hover:underline">
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">No alerts</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((n) => (
                  <li key={n.id}>
                    <Button variant="ghost"
                      type="button"
                      onClick={() => openItem(n)}
                      className={
                        "justify-start flex w-full items-start gap-2.5 border-l-2 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 " +
                        SEVERITY_ACCENT[n.severity] +
                        (n.isRead ? " bg-white" : " bg-primary-50/40")
                      }>
                      <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + SEVERITY_DOT[n.severity]} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={"truncate text-xs " + (n.isRead ? "font-medium text-slate-700" : "font-semibold text-slate-900")}>
                            {n.title}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{shortTime(n.createdAt)}</span>
                        </span>
                        {n.body && <span className="mt-0.5 block line-clamp-2 text-[11px] text-slate-500">{n.body}</span>}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
