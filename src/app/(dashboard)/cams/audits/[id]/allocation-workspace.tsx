"use client";

// ──────────────────────────────────────────────────────────────────────
// Checkpoint allocation — by discipline OR by individual checkpoint.
//
// Discipline-level allocation is the fast path and stays: one department
// usually does own a whole discipline, and assigning 40 checkpoints in one
// click is the difference between a usable screen and a chore.
//
// It is not sufficient on its own, though. Real audits cut across departments
// constantly — the crèche-staffing checkpoint inside HR belongs to the welfare
// officer rather than the HR head, and one electrical item inside Production is
// the maintenance engineer's. The "By checkpoint" tab exists for exactly those,
// with multi-select so a handful of exceptions is still one call.
//
// Both axes are allocatable: the AUDITEE who answers a finding, and the AUDITOR
// who conducts the checkpoint. They were previously only settable together, at
// scheduling, per discipline.
//
// The list is server-paginated for the same reason the conduct screen is — an
// audit can carry 1,500 checkpoints and this dialog must never try to hold them
// all.
// ──────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, Users2, Search, ChevronDown, CheckSquare, Square, UserRound, ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PERSON_CLEAR, PersonGroup, PersonSelect } from "@/components/ui/person-select";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  AuditTeam, AuditTeamMember, CheckpointResponse, DisciplineRollup, apiErrorMessage,
  REQUIREMENT_TYPE_META, CRITICALITY_CHIP, CRITICALITY_FALLBACK,
} from "../lib";

type Candidate = { id: string; name: string; role?: string | null; department?: string | null };
type Slots = {
  leadAuditor: Candidate[]; coAuditor: Candidate[];
  plantManager: Candidate[]; auditee: Candidate[];
};
type Mode = "discipline" | "checkpoint";
const PAGE = 50;

export function AllocationWorkspace({ auditId, plantId, disciplines, knownNames = {}, team = null, onClose, onChanged }: {
  auditId: string;
  plantId: string;
  disciplines: DisciplineRollup[];
  /**
   * Names of everyone already on this audit, from the audit payload.
   *
   * The pickers below list only people ASSIGNABLE at this plant, and a
   * checkpoint's CURRENT assignee need not be one of them — assign someone from
   * another site and this screen could no longer name the person it was showing
   * you, so it printed "Unknown user" and kept printing it after a reset. The
   * audit's own map is the authority for who is already there; the pickers stay
   * the authority for who may be chosen next.
   */
  knownNames?: Record<string, string>;
  /**
   * The audit's own cast, from `audit_assignment.audit_team()`.
   *
   * Allocation distributes work among the people SEATED ON THIS AUDIT — it is
   * not a place to recruit. The pickers used to list everyone assignable at the
   * plant, which was already a long list and became a company-wide one once the
   * auditor/auditee roles moved to ALL_PLANTS scope. Offering someone who is
   * not on the team also produced work nobody had agreed to do: they would
   * never see it on "My Checkpoints" unless separately seated.
   *
   * Each member carries the disciplines they were scoped to, so a row offers
   * only the people actually responsible for that discipline.
   */
  team?: AuditTeam | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("discipline");
  const [slots, setSlots] = useState<Slots | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/audit-compliance/assignable-users?plantId=${encodeURIComponent(plantId)}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (alive) setSlots(j.assignable ?? null);
      } catch {
        // Fail closed — an empty picker with a visible reason beats offering
        // people who are not authorised to hold the seat.
        if (alive) setSlots({ leadAuditor: [], coAuditor: [], plantManager: [], auditee: [] });
      }
    })();
    return () => { alive = false; };
  }, [plantId]);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>(Object.entries(knownNames));
    for (const list of Object.values(slots ?? {})) for (const u of list) m.set(u.id, u.name);
    return (id: string | null | undefined) => (id ? m.get(id) ?? "Unknown user" : null);
  }, [slots, knownNames]);

  /** One allocation call. `set*` flags say which axis is changing, because a
   *  null id means "unassign", not "leave alone". */
  const allocate = useCallback(async (body: Record<string, unknown>, label: string) => {
    const res = await fetch(`/api/audit-compliance/${auditId}/allocate`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Allocation failed", description: apiErrorMessage(j, res.status) });
      return null;
    }
    const j = await res.json();
    toast({ variant: "success", title: "Allocation updated", description: `${label} · ${j.updated} checkpoint(s).` });
    onChanged();
    return j;
  }, [auditId, toast, onChanged]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl gap-0 p-0">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users2 size={18} className="text-primary-700" /> Checkpoint allocation
          </DialogTitle>
          <DialogDescription className="sr-only">
            Assign checkpoints to the auditor who conducts them and the auditee who answers them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5 border-b bg-slate-50 px-5 py-2">
          {([
            { key: "discipline" as Mode, label: "By discipline", hint: "Assign a whole discipline at once" },
            { key: "checkpoint" as Mode, label: "By checkpoint", hint: "Pick individual checkpoints that cut across departments" },
          ]).map((t) => (
            <Button
              key={t.key} type="button" variant="ghost" title={t.hint}
              onClick={() => setMode(t.key)}
              className={cn(
                "h-auto rounded-full border px-3 py-1 text-[12px] font-medium transition",
                mode === t.key
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
              )}
            >
              {t.label}
            </Button>
          ))}
          <span className="ml-2 text-[11px] text-slate-400">
            {mode === "discipline"
              ? "Auditee answers findings · auditor conducts the checkpoints · nothing is saved until you press Update"
              : "Select any rows — they need not share a discipline"}
          </span>
        </div>

        {slots === null ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            <Loader2 size={16} className="mr-2 animate-spin" /> Loading authorised people…
          </div>
        ) : mode === "discipline" ? (
          <DisciplineTab
            disciplines={disciplines} team={team} busy={busy} setBusy={setBusy} allocate={allocate}
          />
        ) : (
          <CheckpointTab
            auditId={auditId} disciplines={disciplines} team={team} nameOf={nameOf} allocate={allocate}
          />
        )}

        <DialogFooter className="border-t px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Re-exported name for readability at the call sites below. */
const CLEAR = PERSON_CLEAR;

type Axis = "owner" | "auditor";
type RowSel = Record<Axis, string>;
const EMPTY_ROW: RowSel = { owner: "", auditor: "" };

/** Is this member scoped to this discipline?
 *
 *  An empty `disciplines` list means "not narrowed" — the team editor writes
 *  scopes only when someone is deliberately limited, and a co-auditor with no
 *  scope conducts everything not given to someone else. Treating empty as
 *  "covers all" matches the engine. */
function coversDiscipline(m: AuditTeamMember, disciplineId: string) {
  return !m.disciplines?.length || m.disciplines.some((d) => d.id === disciplineId);
}

/** Split the team into "scoped to this discipline" and "everyone else".
 *
 *  This used to be a hard FILTER, and that was wrong. A team with one auditee
 *  per discipline then offered exactly one name per row and no way to pick
 *  anybody else — but allocation is precisely the moment you decide who takes
 *  a discipline's work, and the existing scope is a starting point, not a
 *  fence. Someone deliberately seated on this audit must always be selectable.
 *
 *  So the scope now orders the list instead of truncating it: the people
 *  already responsible for this discipline come first under their own heading,
 *  the rest of the team follows. Nothing is hidden and the common pick is still
 *  the top one. */
function groupForDiscipline(
  all: AuditTeamMember[], disciplineId: string | null, disciplineName: string,
  leadId?: string | null,
): PersonGroup[] {
  const opt = (m: AuditTeamMember) => ({
    id: m.userId,
    name: m.name,
    role: m.role,
    department: m.department,
    badge: m.userId === leadId ? "Lead" : undefined,
    // An unauthorised seat is exactly why their action would 403 later — worth
    // seeing BEFORE handing them 40 checkpoints.
    warn: m.authorised ? undefined : "Not authorised at this plant",
  });

  // The By-checkpoint tab selects rows that deliberately cut across
  // disciplines, so there is no single scope to order by — one flat list.
  if (disciplineId === null) return all.length ? [{ label: "", members: all.map(opt) }] : [];

  const inScope = all.filter((m) => coversDiscipline(m, disciplineId));
  const rest = all.filter((m) => !coversDiscipline(m, disciplineId));
  const groups: PersonGroup[] = [];
  if (inScope.length) groups.push({ label: `Assigned to ${disciplineName}`, members: inScope.map(opt) });
  if (rest.length) groups.push({ label: "Other team members", members: rest.map(opt) });
  return groups;
}

/** Everyone who may CONDUCT checkpoints: the lead auditor, then the co-auditors.
 *
 *  The lead belongs in this list by right, not as a courtesy — the team panel
 *  states the rule as "conducts every discipline not assigned to a co-auditor",
 *  so they cover all of them. They were missing because the picker was built
 *  from `coAuditors` alone, and the lead is a separate seat on the team.
 *
 *  This also retires the old "— lead auditor —" pseudo-option. It looked like a
 *  different kind of thing from picking a person, but the server resolves
 *  `auditorId: null` as `audit.leadAuditorUserId` and writes exactly the id
 *  that naming the lead would have written. Two controls, one outcome, and the
 *  vaguer one hid whose name it meant. */
function conductors(team: AuditTeam | null): AuditTeamMember[] {
  const co = team?.coAuditors ?? [];
  const lead = team?.leadAuditor;
  if (!lead) return co;
  return [lead, ...co.filter((m) => m.userId !== lead.userId)];
}

function DisciplineTab({ disciplines, team, busy, setBusy, allocate }: {
  disciplines: DisciplineRollup[]; team: AuditTeam | null;
  busy: string | null; setBusy: (v: string | null) => void;
  allocate: (body: Record<string, unknown>, label: string) => Promise<unknown>;
}) {
  // What the pickers currently show, and what was last written. A row is dirty
  // when they disagree — which is the whole point of the Update button: picking
  // a name is a statement of intent, not the act itself. Allocating a whole
  // discipline moves 40+ checkpoints, and firing that on the change event meant
  // a mis-click was already saved before you could read what it said.
  const [sel, setSel] = useState<Record<string, RowSel>>({});
  const [saved, setSaved] = useState<Record<string, RowSel>>({});

  const rowOf = (id: string, m: Record<string, RowSel>) => m[id] ?? EMPTY_ROW;
  const isDirty = (id: string) => {
    const a = rowOf(id, sel), b = rowOf(id, saved);
    return a.owner !== b.owner || a.auditor !== b.auditor;
  };
  const pick = (id: string, axis: Axis, value: string) =>
    setSel((m) => ({ ...m, [id]: { ...rowOf(id, m), [axis]: value } }));

  const labelFor = (axis: Axis, value: string, pool: AuditTeamMember[]) => {
    if (value === CLEAR) return "Unassigned";  // auditee axis only
    return pool.find((m) => m.userId === value)?.name ?? value;
  };

  /** Commit one discipline. Each axis is its own call because `setOwner` /
   *  `setAuditor` are what tell the server which axis this request changes —
   *  an untouched axis must not be sent at all, or "leave alone" would be
   *  indistinguishable from "unassign". */
  async function update(g: DisciplineRollup, pools: { owner: AuditTeamMember[]; auditor: AuditTeamMember[] }) {
    const now = rowOf(g.categoryId, sel);
    const was = rowOf(g.categoryId, saved);
    setBusy(g.categoryId);
    try {
      const done: RowSel = { ...was };
      for (const axis of ["owner", "auditor"] as Axis[]) {
        const v = now[axis];
        if (v === "" || v === was[axis]) continue;
        const userId = v === CLEAR ? null : v;
        const ok = await allocate(
          axis === "owner"
            ? { disciplineId: g.categoryId, ownerId: userId, setOwner: true }
            : { disciplineId: g.categoryId, auditorId: userId, setOwner: false, setAuditor: true },
          `${g.categoryName} · ${axis === "owner" ? "Auditee" : "Auditor"} → ${labelFor(axis, v, pools[axis])}`,
        );
        // A failed axis stays dirty so Update remains available to retry it; a
        // succeeded one is recorded even if its sibling then fails, because it
        // really was written.
        if (ok) done[axis] = v;
      }
      setSaved((m) => ({ ...m, [g.categoryId]: done }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-h-[58vh] overflow-y-auto">
      <div className="sticky top-0 z-10 grid grid-cols-[1fr_11rem_11rem_5.5rem] items-center gap-2 border-b bg-white px-5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span>Discipline</span>
        <span className="flex items-center gap-1"><UserRound size={11} /> Auditee</span>
        <span className="flex items-center gap-1"><ClipboardCheck size={11} /> Auditor</span>
        <span className="text-right">Action</span>
      </div>
      <div className="divide-y divide-slate-100">
        {disciplines.map((g) => {
          const row = rowOf(g.categoryId, sel);
          const dirty = isDirty(g.categoryId);
          const working = busy === g.categoryId;
          const pools = {
            owner: team?.auditees ?? [],
            auditor: conductors(team),
          };
          return (
            <div key={g.categoryId} className="grid grid-cols-[1fr_11rem_11rem_5.5rem] items-center gap-2 px-5 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.categoryColor || "#94a3b8" }} />
                <span className="min-w-0 truncate text-sm font-medium text-slate-700">{g.categoryName}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{g.total} cp</span>
                {dirty && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    Not saved
                  </span>
                )}
              </div>

              <PersonSelect
                value={row.owner} disabled={working} className="h-8 px-2 text-xs"
                groups={groupForDiscipline(pools.owner, g.categoryId, g.categoryName)}
                placeholder="Assign auditee →" clearLabel="— unassign —"
                emptyText="This audit has no auditees yet. Add them under Edit team."
                onPick={(v) => pick(g.categoryId, "owner", v)}
              />

              <PersonSelect
                value={row.auditor} disabled={working} className="h-8 px-2 text-xs"
                groups={groupForDiscipline(pools.auditor, g.categoryId, g.categoryName, team?.leadAuditor?.userId)}
                placeholder="Assign auditor →"
                emptyText="This audit has no lead auditor or co-auditor. Add one under Edit team."
                onPick={(v) => pick(g.categoryId, "auditor", v)}
              />

              <div className="flex justify-end">
                <Button
                  type="button" size="sm" className="h-8 px-3 text-xs"
                  disabled={!dirty || working}
                  onClick={() => update(g, pools)}
                  title={dirty ? `Apply to ${g.total} checkpoint(s)` : "Pick an auditee or auditor first"}
                >
                  {working ? <Loader2 size={13} className="animate-spin" /> : "Update"}
                </Button>
              </div>
            </div>
          );
        })}
        {disciplines.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400">No disciplines materialized.</div>
        )}
      </div>
    </div>
  );
}

function CheckpointTab({ auditId, disciplines, team, nameOf, allocate }: {
  auditId: string; disciplines: DisciplineRollup[]; team: AuditTeam | null;
  nameOf: (id: string | null | undefined) => string | null;
  allocate: (body: Record<string, unknown>, label: string) => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [disciplineId, setDisciplineId] = useState("ALL");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [items, setItems] = useState<CheckpointResponse[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  // Staged picker values for the bulk bar; "" means untouched.
  const [pend, setPend] = useState<RowSel>(EMPTY_ROW);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(async (reset: boolean, cur: string | null) => {
    const params = new URLSearchParams({ limit: String(PAGE) });
    if (disciplineId !== "ALL") params.set("disciplineId", disciplineId);
    if (qDebounced) params.set("q", qDebounced);
    if (!reset && cur) params.set("cursor", cur);
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-compliance/${auditId}/checkpoints?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({ variant: "error", title: "Couldn't load checkpoints", description: apiErrorMessage(j, res.status) });
        return;
      }
      const j = await res.json();
      setTotal(j.total ?? 0);
      setCursor(j.nextCursor ?? null);
      setItems((prev) => (reset ? j.items : [...prev, ...j.items]));
    } finally {
      setLoading(false);
    }
  }, [auditId, disciplineId, qDebounced, toast]);

  useEffect(() => {
    // Scope changed — the previous selection referred to rows that may no
    // longer be on screen, and silently carrying it would allocate checkpoints
    // the user can no longer see.
    setSelected(new Set());
    fetchPage(true, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciplineId, qDebounced]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  const allLoadedSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  function toggleAllLoaded() {
    setSelected((prev) => {
      if (allLoadedSelected) {
        const n = new Set(prev);
        items.forEach((i) => n.delete(i.id));
        return n;
      }
      return new Set([...prev, ...items.map((i) => i.id)]);
    });
  }

  /** Apply the staged pickers to the selected rows.
   *
   *  Staged, not immediate: this bar can be carrying 500 selected checkpoints,
   *  and firing on the picker's change event meant the write had already
   *  happened by the time you read the name you had landed on. */
  async function apply() {
    if (selected.size === 0) return;
    setApplying(true);
    const ids = [...selected];
    let wrote = false;
    try {
      for (const axis of ["owner", "auditor"] as Axis[]) {
        const v = pend[axis];
        if (v === "") continue;  // untouched — must not be sent at all
        const userId = v === CLEAR ? null : v;
        const pool = axis === "owner" ? (team?.auditees ?? []) : conductors(team);
        const name = v === CLEAR ? "Unassigned" : pool.find((m) => m.userId === v)?.name ?? v;
        const ok = await allocate(
          axis === "owner"
            ? { checkpointIds: ids, ownerId: userId, setOwner: true }
            : { checkpointIds: ids, auditorId: userId, setOwner: false, setAuditor: true },
          `${axis === "owner" ? "Auditee" : "Auditor"} → ${name}`,
        );
        if (ok) wrote = true;
      }
    } finally {
      setApplying(false);
    }
    if (wrote) {
      setSelected(new Set());
      setPend(EMPTY_ROW);
      fetchPage(true, null);
    }
  }

  return (
    <div className="flex max-h-[58vh] flex-col">
      {/* Scope + search */}
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-2">
        <Select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} className="h-8 w-52 text-xs">
          <option value="ALL">All disciplines</option>
          {disciplines.map((d) => <option key={d.categoryId} value={d.categoryId}>{d.categoryName}</option>)}
        </Select>
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code / question…" className="h-8 w-56 pl-7 text-xs" />
        </div>
        <Button type="button" variant="ghost" onClick={toggleAllLoaded} className="h-8 gap-1.5 px-2 text-[12px] text-slate-600">
          {allLoadedSelected ? <CheckSquare size={14} /> : <Square size={14} />}
          {allLoadedSelected ? "Clear loaded" : "Select loaded"}
        </Button>
        <span className="ml-auto text-[11px] text-slate-400">{total} checkpoint{total === 1 ? "" : "s"}</span>
      </div>

      {/* Bulk bar — only once something is selected, so it never occupies space
          while the user is still choosing. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-primary-200 bg-primary-50/70 px-5 py-2">
          <span className="text-[12px] font-semibold text-primary-900">{selected.size} selected</span>
          <Label className="ml-2 text-[11px] text-slate-500">Auditee</Label>
          <div className="w-44">
            <PersonSelect
              value={pend.owner} disabled={applying} className="h-8 px-2 text-xs"
              groups={groupForDiscipline(team?.auditees ?? [], null, "")}
              placeholder="Assign →" clearLabel="— unassign —"
              emptyText="This audit has no auditees yet. Add them under Edit team."
              onPick={(v) => setPend((p) => ({ ...p, owner: v }))}
            />
          </div>
          <Label className="text-[11px] text-slate-500">Auditor</Label>
          <div className="w-44">
            <PersonSelect
              value={pend.auditor} disabled={applying} className="h-8 px-2 text-xs"
              groups={groupForDiscipline(conductors(team), null, "", team?.leadAuditor?.userId)}
              placeholder="Assign →"
              emptyText="This audit has no lead auditor or co-auditor. Add one under Edit team."
              onPick={(v) => setPend((p) => ({ ...p, auditor: v }))}
            />
          </div>
          <Button
            type="button" size="sm" className="h-8 px-3 text-xs"
            disabled={applying || (pend.owner === "" && pend.auditor === "")}
            onClick={apply}
            title={pend.owner === "" && pend.auditor === ""
              ? "Pick an auditee or auditor first"
              : `Apply to ${selected.size} checkpoint(s)`}
          >
            {applying ? <Loader2 size={13} className="animate-spin" /> : "Update"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setSelected(new Set()); setPend(EMPTY_ROW); }} className="ml-auto h-7 text-[11px] text-slate-500">
            Clear
          </Button>
        </div>
      )}

      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            <Loader2 size={16} className="mr-2 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No checkpoints match this filter.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((r) => {
              const on = selected.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button" onClick={() => toggle(r.id)} aria-pressed={on}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-5 py-2 text-left transition",
                      on ? "bg-primary-50/60" : "hover:bg-slate-50",
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-slate-400">
                      {on ? <CheckSquare size={15} className="text-primary-600" /> : <Square size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-slate-500">{r.checkpointCode}</span>
                        {r.requirementType && (
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase", REQUIREMENT_TYPE_META[r.requirementType].chip)}>
                            {REQUIREMENT_TYPE_META[r.requirementType].short}
                          </span>
                        )}
                        <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase", CRITICALITY_CHIP[r.criticality] ?? CRITICALITY_FALLBACK)}>
                          {r.criticality}
                        </span>
                        <span className="text-[10px] text-slate-400">{r.categoryName}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-slate-700">{r.checkpointQuestion}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
                        <span className={cn(r.assignedOwnerId ? "text-slate-500" : "text-amber-600")}>
                          <UserRound size={10} className="mr-0.5 inline" />
                          {nameOf(r.assignedOwnerId) ?? "no auditee"}
                        </span>
                        <span className="text-slate-500">
                          <ClipboardCheck size={10} className="mr-0.5 inline" />
                          {nameOf(r.assignedAuditorId) ?? "lead auditor"}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {cursor && (
          <div className="p-3">
            <Button type="button" variant="outline" className="w-full" onClick={() => fetchPage(false, cursor)} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
              Load more ({total - items.length} remaining)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
