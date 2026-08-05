"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Printer,
  Shield,
  WifiOff,
  X,
} from "lucide-react";
import { CRISIS_STATUS_CHIP, SEVERITY_LABEL, type CrisisDetail } from "@/app/(dashboard)/erm/lib-p3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const LOG_TYPES = ["DECISION", "ACTION", "COMMUNICATION", "STATUS_UPDATE"] as const;

const LOG_CHIP: Record<string, string> = {
  DECISION: "bg-violet-100 text-violet-800 border-violet-200",
  ACTION: "bg-blue-100 text-blue-800 border-blue-200",
  COMMUNICATION: "bg-amber-100 text-amber-800 border-amber-200",
  STATUS_UPDATE: "bg-slate-100 text-slate-700 border-slate-200",
  TASK_CHECK: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function cacheKey(id: string) {
  return `safeops_crisis_${id}`;
}

function fmtTime(d: string): string {
  try {
    return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d;
  }
}

function fmtElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function CrisisWorkspace({
  crisisId,
  initial,
  serverError,
}: {
  crisisId: string;
  initial: CrisisDetail | null;
  serverError: string | null;
}) {
  const router = useRouter();
  const [crisis, setCrisis] = useState<CrisisDetail | null>(initial);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Cache the freshly-loaded detail; or, if the server fetch failed, fall back
  // to the cached copy and flag offline.
  useEffect(() => {
    if (initial) {
      try {
        localStorage.setItem(cacheKey(crisisId), JSON.stringify(initial));
      } catch {
        /* quota / disabled — ignore */
      }
      setCrisis(initial);
      setOffline(false);
      return;
    }
    // No server payload — try cache.
    try {
      const raw = localStorage.getItem(cacheKey(crisisId));
      if (raw) {
        setCrisis(JSON.parse(raw) as CrisisDetail);
        setOffline(true);
      }
    } catch {
      /* ignore */
    }
  }, [initial, crisisId]);

  // Live elapsed clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!crisis) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {serverError ?? "Crisis not found."} No cached copy is available on this device.
      </div>
    );
  }

  const activatedMs = new Date(crisis.activatedAt).getTime();
  const elapsedMs = crisis.standDownAt ? new Date(crisis.standDownAt).getTime() - activatedMs : now - activatedMs;
  const elapsedHours = elapsedMs / 3_600_000;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      {offline && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <WifiOff size={18} /> Offline — showing the last cached copy. Actions are disabled until you reconnect.
        </div>
      )}

      {/* ── Status header ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-xs text-slate-500">{crisis.crisisCode}</div>
            <h1 className="text-xl font-bold text-slate-900">{crisis.title}</h1>
            <div className="mt-1 text-sm text-slate-500">
              {crisis.siteName ?? "Corporate"} · activated {fmtTime(crisis.activatedAt)} by {crisis.activatedByName ?? "—"}
            </div>
          </div>
          <span className={"inline-flex items-center rounded border px-2.5 py-1 text-xs font-semibold " + (CRISIS_STATUS_CHIP[crisis.status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
            {crisis.status.replace(/_/g, " ")}
          </span>
        </div>

        {/* Elapsed clock */}
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white">
          <Clock size={20} className="text-rose-400" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">{crisis.standDownAt ? "Total duration" : "Elapsed since activation"}</div>
            <div className="text-2xl font-bold tabular-nums">{fmtElapsed(elapsedMs)}</div>
          </div>
        </div>

        {/* Severity control */}
        <SeverityControl crisis={crisis} disabled={offline || crisis.status === "CLOSED"} />
      </div>

      {/* ── Recovery checklist ────────────────────────────────── */}
      <RecoverySection crisis={crisis} elapsedHours={elapsedHours} disabled={offline || crisis.status === "CLOSED"} />

      {/* ── Append-only log ───────────────────────────────────── */}
      <LogSection crisis={crisis} disabled={offline || crisis.status === "CLOSED"} />

      {/* ── Team roster ───────────────────────────────────────── */}
      <RosterSection crisis={crisis} />

      {/* ── FSER panel ────────────────────────────────────────── */}
      <FserPanel fser={crisis.fserPanel} />

      {/* ── Actions ───────────────────────────────────────────── */}
      {/* ACTIVATED/MANAGED → can stand down or close directly; STAND_DOWN → close only; CLOSED → none. */}
      {(crisis.status === "ACTIVATED" || crisis.status === "MANAGED") && (
        <StandDownClose crisis={crisis} disabled={offline} onDone={() => router.refresh()} mode="standdown" />
      )}
      {crisis.status !== "CLOSED" && (
        <StandDownClose crisis={crisis} disabled={offline} onDone={() => router.refresh()} mode="close" />
      )}

      <Button type="button" variant="outline" onClick={() => window.print()} className="w-full text-slate-600">
        <Printer size={16} /> Print log (PDF)
      </Button>
    </div>
  );
}

// ── Severity control ──────────────────────────────────────────────────────────
function SeverityControl({ crisis, disabled }: { crisis: CrisisDetail; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function change(lvl: number) {
    if (lvl === crisis.severityLevel || disabled) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/erm/bcm/crisis/${crisis.id}/severity`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ severityLevel: lvl }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.detail || j.error || `Failed (${res.status})`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Severity</span>
        {busy && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((lvl) => {
          const on = crisis.severityLevel === lvl;
          return (
            <Button
              key={lvl}
              type="button"
              variant="ghost"
              onClick={() => change(lvl)}
              disabled={disabled || busy}
              className={cn(
                "min-h-12 rounded-xl border-2 px-2 text-center text-xs font-semibold transition-colors disabled:opacity-50 h-auto",
                on ? "border-rose-600 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              <div className="text-base font-extrabold">{lvl}</div>
              <div className="leading-tight">{SEVERITY_LABEL[lvl]?.replace(/^Sev \d+ — /, "")}</div>
            </Button>
          );
        })}
      </div>
      {err && <p className="mt-1.5 text-xs text-rose-600">{err}</p>}
    </div>
  );
}

// ── Recovery checklist ──────────────────────────────────────────────────────
function RecoverySection({ crisis, elapsedHours, disabled }: { crisis: CrisisDetail; elapsedHours: number; disabled: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const tasks = crisis.recoveryTasks ?? [];
  if (tasks.length === 0) {
    return (
      <Section title="Recovery tasks" icon={<CheckCircle2 size={18} className="text-slate-400" />}>
        <p className="text-sm text-slate-400">No recovery tasks — none of the activated plans defined a recovery checklist.</p>
      </Section>
    );
  }

  async function check(task: (typeof tasks)[number]) {
    if (task.checked || disabled) return;
    setBusyId(task.id);
    setErr(null);
    try {
      const res = await fetch(`/api/erm/bcm/crisis/${crisis.id}/log`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryType: "TASK_CHECK", content: `Completed: ${task.title}`, recoveryTaskId: task.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.detail || j.error || `Failed (${res.status})`);
      } else {
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const done = tasks.filter((t) => t.checked).length;

  return (
    <Section title={`Recovery tasks (${done}/${tasks.length})`} icon={<CheckCircle2 size={18} className="text-slate-400" />}>
      {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}
      <div className="space-y-2">
        {tasks.map((t) => {
          const target = t.targetHoursFromActivation;
          // colour target vs elapsed
          let toneRing = "border-slate-200";
          let toneText = "text-slate-500";
          if (t.checked) {
            toneRing = "border-emerald-200 bg-emerald-50";
          } else if (target != null) {
            if (elapsedHours <= target) { toneRing = "border-emerald-200"; toneText = "text-emerald-700"; }
            else if (elapsedHours <= target * 1.25) { toneRing = "border-amber-300 bg-amber-50"; toneText = "text-amber-700"; }
            else { toneRing = "border-rose-300 bg-rose-50"; toneText = "text-rose-700"; }
          }
          return (
            <Button
              key={t.id}
              type="button"
              variant="ghost"
              onClick={() => check(t)}
              disabled={t.checked || disabled || busyId === t.id}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-default h-auto",
                toneRing
              )}
            >
              <span className="mt-0.5 shrink-0">
                {busyId === t.id ? (
                  <Loader2 size={22} className="animate-spin text-slate-400" />
                ) : t.checked ? (
                  <CheckCircle2 size={22} className="text-emerald-600" />
                ) : (
                  <Circle size={22} className="text-slate-300" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={"block text-base font-medium " + (t.checked ? "text-slate-400 line-through" : "text-slate-900")}>{t.title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {t.responsibleRoleName}
                  {t.planCode ? ` · ${t.planCode}` : ""}
                </span>
                {target != null && (
                  <span className={"mt-0.5 inline-block text-[11px] font-medium " + (t.checked ? "text-slate-400" : toneText)}>
                    Target: within {target}h of activation{!t.checked && elapsedHours > target ? " — OVERDUE" : ""}
                  </span>
                )}
              </span>
            </Button>
          );
        })}
      </div>
    </Section>
  );
}

// ── Append-only log ────────────────────────────────────────────────────────
function LogSection({ crisis, disabled }: { crisis: CrisisDetail; disabled: boolean }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof LOG_TYPES)[number]>("DECISION");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const entries = crisis.logEntries ?? [];

  async function submit() {
    if (!content.trim() || disabled) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/erm/bcm/crisis/${crisis.id}/log`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryType: type, content: content.trim(), recoveryTaskId: null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.detail || j.error || `Failed (${res.status})`);
      } else {
        setContent("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={`Crisis log (${entries.length})`} icon={<MessageSquare size={18} className="text-slate-400" />}>
      {/* Newest last, scrollable */}
      <div className="mb-3 max-h-96 space-y-2 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">No entries yet. Log decisions, actions and communications as they happen — the record is append-only.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className={"rounded border px-1.5 py-0.5 text-[10px] font-semibold " + (LOG_CHIP[e.entryType] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                  {e.entryType.replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-slate-400">{fmtTime(e.timestamp)} · {e.enteredByName ?? "—"}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{e.content}</p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Quick-entry */}
      {!disabled && crisis.status !== "CLOSED" && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {LOG_TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                variant="ghost"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium h-auto",
                  type === t ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-500"
                )}
              >
                {t.replace(/_/g, " ")}
              </Button>
            ))}
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="min-h-12 text-base"
            placeholder="What happened / what was decided…"
          />
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <Button
            type="button"
            onClick={submit}
            disabled={busy || !content.trim()}
            className="min-h-12 w-full text-base font-semibold"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null} Add log entry
          </Button>
        </div>
      )}
    </Section>
  );
}

// ── Team roster ───────────────────────────────────────────────────────────
function RosterSection({ crisis }: { crisis: CrisisDetail }) {
  const roster = [...(crisis.teamRoster ?? [])].sort((a, b) => (a.escalationOrder ?? 0) - (b.escalationOrder ?? 0));
  if (roster.length === 0) {
    return (
      <Section title="Crisis team" icon={<Shield size={18} className="text-slate-400" />}>
        <p className="text-sm text-slate-400">No crisis roster defined for this site. Configure it in Crisis Team & Call Tree admin.</p>
      </Section>
    );
  }
  return (
    <Section title="Crisis team" icon={<Shield size={18} className="text-slate-400" />}>
      <div className="space-y-2">
        {roster.map((r, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900">{r.roleName}</div>
            <Contact label="Primary" name={r.primary} />
            <Contact label="Alternate" name={r.alternate} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function Contact({ label, name }: { label: string; name: string | null }) {
  if (!name) {
    return (
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-sm text-slate-500"><span className="text-[11px] uppercase text-slate-400">{label}: </span><span className="text-rose-600">unassigned</span></span>
      </div>
    );
  }
  // Placeholder contact handles keyed off name — real numbers/emails come from
  // the roster contact fields when available; this gives one-tap channels now.
  const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
  return (
    <div className="mt-1.5 flex items-center justify-between gap-2">
      <span className="min-w-0 text-sm text-slate-700">
        <span className="text-[11px] uppercase text-slate-400">{label}: </span>
        <span className="font-medium">{name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <a href={`tel:`} aria-label={`Call ${name}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 active:bg-emerald-200">
          <Phone size={16} />
        </a>
        <a href={`sms:`} aria-label={`SMS ${name}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 active:bg-blue-200">
          <MessageSquare size={16} />
        </a>
        <a href={`mailto:${slug}@example.com`} aria-label={`Email ${name}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:bg-slate-200">
          <Mail size={16} />
        </a>
      </span>
    </div>
  );
}

// ── FSER panel ──────────────────────────────────────────────────────────────
function FserPanel({ fser }: { fser: any | null }) {
  if (!fser || fser.available === false) {
    return (
      <Section title="Emergency response (FSER)" icon={<MapPin size={18} className="text-slate-400" />}>
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">
          Emergency response data unavailable. {fser?.reason ?? ""}
        </div>
      </Section>
    );
  }
  const assembly: any[] = fser.assemblyPoints ?? [];
  const contacts: any[] = fser.emergencyContacts ?? [];
  return (
    <Section title="Emergency response (FSER)" icon={<MapPin size={18} className="text-slate-400" />}>
      {fser.sitePlanSummary && <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600">{fser.sitePlanSummary}</p>}

      {assembly.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assembly points</div>
          <div className="space-y-1.5">
            {assembly.map((a, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-2.5 text-sm">
                <div className="font-medium text-slate-800">{a.name}</div>
                <div className="text-xs text-slate-500">
                  {a.capacity != null ? `Capacity ${a.capacity}` : ""}{a.wardenRole ? ` · Warden: ${a.wardenRole}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Emergency contacts</div>
          <div className="space-y-1.5">
            {contacts.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5">
                <div className="min-w-0 text-sm">
                  <div className="font-medium text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.role}</div>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex h-10 items-center gap-1.5 rounded-full bg-emerald-100 px-3 text-sm font-medium text-emerald-700 active:bg-emerald-200">
                    <Phone size={15} /> {c.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Stand-down / Close ────────────────────────────────────────────────────
function StandDownClose({ crisis, disabled, onDone, mode }: { crisis: CrisisDetail; disabled: boolean; onDone: () => void; mode: "standdown" | "close" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewCapaId, setReviewCapaId] = useState("");

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const path = mode === "standdown" ? "stand-down" : "close";
      const body = mode === "close" ? { reviewNote: reviewNote.trim() || null, reviewCapaId: reviewCapaId.trim() || null } : {};
      const res = await fetch(`/api/erm/bcm/crisis/${crisis.id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.detail || j.error || `Failed (${res.status})`);
        return;
      }
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (mode === "standdown") {
    return (
      <button
        onClick={run}
        disabled={disabled || busy}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-base font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : null} Stand down
      </button>
    );
  }

  // close
  return (
    <>
      <Button
        type="button"
        variant="success"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="min-h-14 w-full text-base font-semibold"
      >
        Close crisis
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Close & post-crisis review</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8 text-slate-400 hover:text-slate-700"><X size={18} /></Button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              Closure requires a post-crisis review: record a note (e.g. &quot;no further actions required&quot;) <b>or</b> link a CAPA.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Review note</label>
                <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} className="text-base" placeholder="Lessons learned / no actions required…" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Linked CAPA id (optional)</label>
                <Input value={reviewCapaId} onChange={(e) => setReviewCapaId(e.target.value)} className="text-base" placeholder="CAPA id" />
              </div>
              {err && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{err}</span>
                </div>
              )}
              <Button
                type="button"
                variant="success"
                onClick={run}
                disabled={busy || (!reviewNote.trim() && !reviewCapaId.trim())}
                className="min-h-12 w-full text-base font-semibold"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : null} Close crisis
              </Button>
              {!reviewNote.trim() && !reviewCapaId.trim() && (
                <p className="text-center text-[11px] text-slate-400">A review note or a linked CAPA is required to close.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">{icon} {title}</h2>
      {children}
    </div>
  );
}
