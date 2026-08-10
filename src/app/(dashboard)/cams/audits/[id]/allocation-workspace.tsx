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
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  CheckpointResponse, DisciplineRollup, apiErrorMessage,
  REQUIREMENT_TYPE_META, CRITICALITY_CHIP, CRITICALITY_FALLBACK,
} from "../lib";

type Candidate = { id: string; name: string; role?: string | null; department?: string | null };
type Slots = {
  leadAuditor: Candidate[]; coAuditor: Candidate[];
  plantManager: Candidate[]; auditee: Candidate[];
};
type Mode = "discipline" | "checkpoint";
const PAGE = 50;

export function AllocationWorkspace({ auditId, plantId, disciplines, knownNames = {}, onClose, onChanged }: {
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
              ? "Auditee answers findings · auditor conducts the checkpoints"
              : "Select any rows — they need not share a discipline"}
          </span>
        </div>

        {slots === null ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            <Loader2 size={16} className="mr-2 animate-spin" /> Loading authorised people…
          </div>
        ) : mode === "discipline" ? (
          <DisciplineTab
            disciplines={disciplines} slots={slots} busy={busy} setBusy={setBusy} allocate={allocate}
          />
        ) : (
          <CheckpointTab
            auditId={auditId} disciplines={disciplines} slots={slots} nameOf={nameOf} allocate={allocate}
          />
        )}

        <DialogFooter className="border-t px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisciplineTab({ disciplines, slots, busy, setBusy, allocate }: {
  disciplines: DisciplineRollup[]; slots: Slots;
  busy: string | null; setBusy: (v: string | null) => void;
  allocate: (body: Record<string, unknown>, label: string) => Promise<unknown>;
}) {
  async function assign(disciplineId: string, axis: "owner" | "auditor", userId: string, name: string) {
    setBusy(`${disciplineId}:${axis}`);
    await allocate(
      axis === "owner"
        ? { disciplineId, ownerId: userId || null, setOwner: true }
        : { disciplineId, auditorId: userId || null, setOwner: false, setAuditor: true },
      userId ? `${axis === "owner" ? "Auditee" : "Auditor"} → ${name}` : "Unassigned",
    );
    setBusy(null);
  }

  return (
    <div className="max-h-[58vh] overflow-y-auto">
      <div className="sticky top-0 grid grid-cols-[1fr_11rem_11rem] items-center gap-2 border-b bg-white px-5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span>Discipline</span>
        <span className="flex items-center gap-1"><UserRound size={11} /> Auditee</span>
        <span className="flex items-center gap-1"><ClipboardCheck size={11} /> Auditor</span>
      </div>
      <div className="divide-y divide-slate-100">
        {disciplines.map((g) => (
          <div key={g.categoryId} className="grid grid-cols-[1fr_11rem_11rem] items-center gap-2 px-5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.categoryColor || "#94a3b8" }} />
              <span className="min-w-0 truncate text-sm font-medium text-slate-700">{g.categoryName}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{g.total} cp</span>
            </div>
            <Select
              defaultValue="" className="h-8 text-xs"
              disabled={busy === `${g.categoryId}:owner`}
              onChange={(e) => {
                const id = e.target.value;
                const nm = e.target.options[e.target.selectedIndex].text;
                e.target.value = "";
                assign(g.categoryId, "owner", id, nm);
              }}
            >
              <option value="">Assign auditee →</option>
              {slots.auditee.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              <option value="">— unassign —</option>
            </Select>
            <Select
              defaultValue="" className="h-8 text-xs"
              disabled={busy === `${g.categoryId}:auditor`}
              onChange={(e) => {
                const id = e.target.value;
                const nm = e.target.options[e.target.selectedIndex].text;
                e.target.value = "";
                assign(g.categoryId, "auditor", id, nm);
              }}
            >
              <option value="">Assign auditor →</option>
              {slots.coAuditor.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              <option value="">— lead auditor —</option>
            </Select>
          </div>
        ))}
        {disciplines.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400">No disciplines materialized.</div>
        )}
      </div>
    </div>
  );
}

function CheckpointTab({ auditId, disciplines, slots, nameOf, allocate }: {
  auditId: string; disciplines: DisciplineRollup[]; slots: Slots;
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

  async function apply(axis: "owner" | "auditor", userId: string, name: string) {
    if (selected.size === 0) return;
    setApplying(true);
    const ids = [...selected];
    const ok = await allocate(
      axis === "owner"
        ? { checkpointIds: ids, ownerId: userId || null, setOwner: true }
        : { checkpointIds: ids, auditorId: userId || null, setOwner: false, setAuditor: true },
      userId ? `${axis === "owner" ? "Auditee" : "Auditor"} → ${name}` : "Unassigned",
    );
    setApplying(false);
    if (ok) {
      setSelected(new Set());
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
          <Select
            defaultValue="" className="h-8 w-44 text-xs" disabled={applying}
            onChange={(e) => {
              const id = e.target.value;
              const nm = e.target.options[e.target.selectedIndex].text;
              e.target.value = "";
              apply("owner", id, nm);
            }}
          >
            <option value="">Assign →</option>
            {slots.auditee.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            <option value="">— unassign —</option>
          </Select>
          <Label className="text-[11px] text-slate-500">Auditor</Label>
          <Select
            defaultValue="" className="h-8 w-44 text-xs" disabled={applying}
            onChange={(e) => {
              const id = e.target.value;
              const nm = e.target.options[e.target.selectedIndex].text;
              e.target.value = "";
              apply("auditor", id, nm);
            }}
          >
            <option value="">Assign →</option>
            {slots.coAuditor.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            <option value="">— lead auditor —</option>
          </Select>
          {applying && <Loader2 size={14} className="animate-spin text-primary-700" />}
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="ml-auto h-7 text-[11px] text-slate-500">
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
