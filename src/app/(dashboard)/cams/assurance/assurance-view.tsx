"use client";

// Independence Register — impartiality evidence as its own artefact.
//
// **What changed and why.** This screen used to be a person lookup: it defaulted
// to the signed-in user and asked you to type a name. That is backwards for an
// impartiality register — the reader is a certification body, and the one thing
// they do not have is a name to type. They ask "show me that your auditors were
// impartial", and the answer has to be a list you can hand over.
//
// Two sections, in the order that evidence is worth reading:
//
//   1. **Dual-role register** — everyone carrying two hats or an ownership of
//      record, ranked with genuine cross-engagement dual roles on OPEN
//      engagements first. Rule 3 says these are *permitted* and must be
//      visible, so they are styled as governance, not as violations.
//   2. **Enforcement log** — every verdict the guard reached. A blocked attempt
//      that was never overridden is stronger evidence than a waiver is: a
//      waiver says "we noticed and allowed it", a block says "we noticed and
//      stopped". Both belong here; only one of them existed before.
//
// The person search survives as a FILTER over section 1, never as the entry
// point. Selecting somebody with nothing recorded says so explicitly rather
// than rendering a blank card.
//
// Ownership of record — the `DisciplineOwner` CRUD — has moved to
// `/cams/admin/types`. It is configuration, and pairing config with evidence is
// what made this screen read half-empty regardless of how much data either had.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, ShieldAlert, Users, Search, X, ExternalLink, Settings2,
  FileClock, CheckCircle2, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserPicker } from "@/components/ui/user-picker";
import { usePermission } from "@/components/auth/can";
import { Alert } from "@/components/ui/alert";
import {
  OUTCOME_META, REGISTER_STATUS, SOURCE_LABEL, engagementHref,
  type IndependenceEventRow, type IndependenceEventsResponse,
  type RegisterResponse, type RegisterRow, type TwoHatRow,
} from "../lib-assurance";

type Tab = "register" | "events";

export function AssuranceView({
  register, events, error,
}: {
  register: RegisterResponse | null;
  events: IndependenceEventsResponse | null;
  error: string | null;
}) {
  const [tab, setTab] = useState<Tab>("register");
  const canConfig = usePermission("CAMS.TYPE_CONFIG");

  return (
    <div className="space-y-5">
      {error && (
        <Card className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <p className="mt-1 text-xs text-rose-600">
            If the enforcement log has not been created yet, run
            <code className="mx-1 rounded bg-white px-1">scripts/add_independence_event.py</code>
            and restart the backend.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Dual role, open"
          value={register?.dualRoleOpenCount ?? 0}
          tone={register?.dualRoleOpenCount ? "amber" : "slate"}
          hint="Auditor on one live engagement, auditee on another"
        />
        <Metric
          label="Owners of record"
          value={register?.ownerOfRecordCount ?? 0}
          tone="sky"
          hint="Standing area or discipline ownership"
        />
        <Metric
          label="Blocked attempts"
          value={events?.blockedStanding ?? 0}
          tone={events?.blockedStanding ? "emerald" : "slate"}
          hint="The guard refused and was not overridden"
        />
        <Metric
          label="Waived"
          value={events?.waivedCount ?? 0}
          tone={events?.waivedCount ? "violet" : "slate"}
          hint="Blocks overridden with a named approver"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        <TabButton active={tab === "register"} onClick={() => setTab("register")}>
          <Users size={14} /> Dual-role register
          <Count n={register?.total ?? 0} />
        </TabButton>
        <TabButton active={tab === "events"} onClick={() => setTab("events")}>
          <FileClock size={14} /> Enforcement log
          <Count n={events?.total ?? 0} />
        </TabButton>
        {canConfig && (
          <Link
            href="/cams/admin/types"
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 hover:text-slate-800"
          >
            <Settings2 size={13} /> Ownership of record
          </Link>
        )}
      </div>

      {tab === "register" && <RegisterTab data={register} />}
      {tab === "events" && <EventsTab data={events} />}
    </div>
  );
}

// ── Section 1 ────────────────────────────────────────────────────────

function RegisterTab({ data }: { data: RegisterResponse | null }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const rows = data?.items ?? [];
  const filtered = useMemo(() => {
    let out = rows;
    if (picked) out = out.filter((r) => r.userId === picked);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter((r) =>
        `${r.userName ?? ""} ${r.designation ?? ""}`.toLowerCase().includes(needle),
      );
    }
    return out;
  }, [rows, q, picked]);

  // Search is a filter, not the entry point — so a person who is genuinely not
  // in the register gets an explicit answer instead of a blank card.
  const pickedMissing = picked && !rows.some((r) => r.userId === picked);

  return (
    <div className="space-y-3">
      <Card className="rounded-xl border border-slate-200 p-4">
        <p className="max-w-prose text-xs text-slate-500">
          Everyone who audits, is audited, or owns something the own-work guard reads. A dual role
          across <em>different</em> engagements is <strong>permitted</strong> under ISO 19011 §5.4.2
          — the requirement is that it is visible, which is what this list is for. Ranked so the
          rows a certification body asks about come first.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name or designation…"
              className="h-9 pl-8"
            />
          </div>
          <div className="min-w-56 flex-1">
            <UserPicker
              value={picked}
              onChange={(id) => setPicked(id)}
              placeholder="Jump to a person…"
            />
          </div>
          {(q || picked) && (
            <Button type="button" size="sm" variant="outline"
              onClick={() => { setQ(""); setPicked(null); }}>
              <X size={13} /> Clear
            </Button>
          )}
        </div>
      </Card>

      {pickedMissing && (
        <Card className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-2">
            <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">
                No independence events recorded for this person.
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                They audit nothing, are audited on nothing, and own no area or discipline the
                guard reads. That is a clean result, not a missing record — the register covers
                all four ownership sources.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!pickedMissing && filtered.length === 0 && (
        <Card className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <ShieldCheck size={26} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-600">
            {rows.length === 0
              ? "Nobody in this tenant currently carries a dual role or an ownership of record."
              : "No one matches that filter."}
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((r) => <RegisterCard key={r.userId} row={r} />)}
      </div>
    </div>
  );
}

function RegisterCard({ row }: { row: RegisterRow }) {
  const meta = REGISTER_STATUS[row.status] ?? REGISTER_STATUS.OWNER_OF_RECORD;
  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {row.userName ?? row.userId}
            </span>
            <span className={cn("rounded border px-1.5 py-0.5 text-[11px]", meta.chip)}>
              {meta.label}
            </span>
          </div>
          {row.designation && (
            <div className="text-[11px] text-slate-500">{row.designation}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {row.sources.map((s) => (
            <span key={s}
              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
              {SOURCE_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <RoleColumn
          title="As auditor"
          count={row.auditorCount}
          openCount={row.openAuditorCount}
          rows={row.asAuditor}
        />
        <RoleColumn
          title="As auditee"
          count={row.auditeeCount}
          openCount={row.openAuditeeCount}
          rows={row.asAuditee}
        />
      </div>

      {row.ownershipOfRecord.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Ownership of record
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {row.ownershipOfRecord.map((o, i) => (
              <span key={`${o.source}-${i}`}
                className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-900">
                {o.label}
                <span className="text-sky-500"> · {SOURCE_LABEL[o.source] ?? o.source}</span>
                {o.detail?.estateWide ? <span className="text-sky-500"> · estate-wide</span> : null}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Standing responsibility. The guard blocks on it even when this person is on no
            engagement at all, which is why it is listed separately from the two hats.
          </p>
        </div>
      )}
    </Card>
  );
}

function RoleColumn({
  title, count, openCount, rows,
}: { title: string; count: number; openCount: number; rows: TwoHatRow[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {title}
        <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">{count}</span>
        {openCount > 0 && (
          <span className="rounded bg-amber-100 px-1.5 text-[10px] text-amber-800">
            {openCount} open
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">None.</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1">
          {rows.slice(0, 8).map((r, i) => {
            const href = engagementHref(r.engagementKind, r.engagementId);
            const label = r.code ?? r.engagementCode ?? r.label ?? "engagement";
            const chip = (
              <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 hover:border-violet-300 hover:text-violet-800">
                {label}
                {href && <ExternalLink size={9} className="text-slate-400" />}
              </span>
            );
            return href ? (
              <Link key={`${r.engagementId}-${i}`} href={href} title={r.title ?? r.label}>
                {chip}
              </Link>
            ) : (
              <span key={`${r.engagementId}-${i}`} title={r.title ?? r.label}>{chip}</span>
            );
          })}
          {rows.length > 8 && (
            <span className="text-[11px] text-slate-400">+{rows.length - 8} more</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section 2 ────────────────────────────────────────────────────────

const OUTCOME_FILTERS = ["", "BLOCKED", "WAIVED", "WARNED"] as const;

function EventsTab({ data }: { data: IndependenceEventsResponse | null }) {
  const [outcome, setOutcome] = useState<string>("");
  const rows = (data?.items ?? []).filter((e) => !outcome || e.outcome === outcome);

  return (
    <div className="space-y-3">
      <Card className="rounded-xl border border-slate-200 p-4">
        <p className="max-w-prose text-xs text-slate-500">
          Every verdict the independence guard reached, in order. <strong>A blocked attempt that
          was never overridden is the strongest evidence here</strong> — a waiver shows the
          exception was governed; a block shows the rule was enforced. Nothing in this log is ever
          edited: revoking a waiver appends a new block rather than deleting the override.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {OUTCOME_FILTERS.map((o) => (
            <Button key={o || "all"} type="button" size="sm"
              variant={outcome === o ? "default" : "outline"}
              className="h-7 rounded-full px-2.5 text-[11px]"
              onClick={() => setOutcome(o)}>
              {o ? OUTCOME_META[o].label : "All"}
              {o && data?.counts?.[o] ? ` · ${data.counts[o]}` : ""}
            </Button>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <ShieldAlert size={26} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-600">No independence events recorded yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            An event is written every time the guard blocks, warns or is waived — at scheduling
            pre-flight and at audit creation. Until an assignment is attempted there is nothing to
            show.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: IndependenceEventRow }) {
  const meta = OUTCOME_META[event.outcome] ?? OUTCOME_META.CLEARED;
  const href = engagementHref(event.engagementKind, event.engagementId);
  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]", meta.chip)}>
          <span className={cn("size-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
        {event.source && (
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
            {SOURCE_LABEL[event.source] ?? event.source}
          </span>
        )}
        {event.rule && (
          <span className="text-[10px] text-slate-400">
            {event.rule.replace(/_/g, " ").toLowerCase()}
          </span>
        )}
        <span className="ml-auto text-[11px] text-slate-400">
          {event.occurredAt ? new Date(event.occurredAt).toLocaleString("en-IN", {
            dateStyle: "medium", timeStyle: "short",
          }) : "—"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-sm">
        <span className="font-medium text-slate-800">
          {event.subjectUserName ?? event.subjectUserId}
        </span>
        <span className="text-xs text-slate-500">
          {event.outcome === "WAIVED" ? "was waived onto" : "was blocked from"}
        </span>
        {href ? (
          <Link href={href} className="text-xs text-violet-800 hover:underline">
            {event.engagementCode ?? "the engagement"}
          </Link>
        ) : (
          <span className="text-xs text-slate-500">
            {event.engagementCode ?? "an engagement that was never created"}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-600">{event.reason}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {event.attemptedByUserName && (
          <span>attempted by {event.attemptedByUserName}</span>
        )}
        <span className="rounded bg-slate-100 px-1.5 text-[10px]">
          {event.origin.replace(/_/g, " ").toLowerCase()}
        </span>
      </div>

      {event.waiver ? (
        <Alert variant="brand" className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-2.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-violet-900">
            <CheckCircle2 size={12} />
            Waived by {event.waiver.approvedByUserName ?? event.waiver.approvedByUserId}
            {event.waiver.revokedAt && (
              <span className="rounded bg-white px-1.5 text-[10px] text-rose-700">revoked</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-violet-900">{event.waiver.justification}</p>
        </Alert>
      ) : event.outcome === "BLOCKED" ? (
        <p className="mt-2 text-[11px] text-emerald-700">
          Never overridden — no waiver was granted for this conflict.
        </p>
      ) : null}
    </Card>
  );
}

// ── Shared ───────────────────────────────────────────────────────────

const TONE: Record<string, string> = {
  slate: "border-slate-200 bg-white text-slate-700",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  sky: "border-sky-200 bg-sky-50 text-sky-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900",
};

function Metric({
  label, value, tone, hint,
}: { label: string; value: number; tone: keyof typeof TONE; hint: string }) {
  return (
    <Card className={cn("rounded-xl border p-3", TONE[tone])} title={hint}>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] font-medium">{label}</div>
      <div className="mt-0.5 text-[10px] opacity-70">{hint}</div>
    </Card>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">{n}</span>;
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
        active
          ? "border-violet-600 text-violet-800"
          : "border-transparent text-slate-500 hover:text-slate-800",
      )}
    >
      {children}
    </button>
  );
}
