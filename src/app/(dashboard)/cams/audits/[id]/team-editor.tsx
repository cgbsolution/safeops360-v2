"use client";

// ──────────────────────────────────────────────────────────────────────
// Re-seat the audit team AFTER the audit exists.
//
// The team used to be fixed in the Schedule Audit modal and never editable
// again, which does not survive a real audit: the auditees are usually not
// known when the audit is scheduled. They are identified at the opening
// meeting, once the auditor has met the departments and knows who actually
// owns what. Until then the honest answer is "not yet decided", and the
// product had no way to say that — so the field was filled with a guess and
// every finding routed to the plant manager.
//
// This dialog stays open for editing right up until closure. Changing the
// cast RE-ROUTES the checkpoints on the server, and the dialog says how many
// moved rather than leaving the user to wonder whether it took effect.
// ──────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users2, X, Plus, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { AuditDetail, DisciplineRollup, apiErrorMessage } from "../lib";

type Candidate = { id: string; name: string; role?: string | null; department?: string | null };
type Slots = {
  leadAuditor: Candidate[]; coAuditor: Candidate[];
  plantManager: Candidate[]; auditee: Candidate[];
};

/** A seated person plus the disciplines they cover. Empty disciplines means
 *  "none by allocation" for a co-auditor (the lead covers them) and "no
 *  routing" for an auditee — a real state, not an incomplete form. */
type Seat = { userId: string; disciplineIds: string[] };

export function TeamEditor({ audit, disciplines, onClose, onSaved }: {
  audit: AuditDetail;
  disciplines: DisciplineRollup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<Slots | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [coAuditors, setCoAuditors] = useState<Seat[]>(() =>
    (audit.team?.coAuditors ?? []).map((m) => ({
      userId: m.userId, disciplineIds: (m.disciplines ?? []).map((d) => d.id),
    })),
  );
  const [auditees, setAuditees] = useState<Seat[]>(() =>
    (audit.team?.auditees ?? []).map((m) => ({
      userId: m.userId, disciplineIds: (m.disciplines ?? []).map((d) => d.id),
    })),
  );
  const [plantManagerUserId, setPM] = useState(audit.plantManagerUserId ?? "");
  const [overrideManual, setOverrideManual] = useState(false);

  // Fetched on open, not passed down, so the lists always reflect the CURRENT
  // permission grants — revoke a role in Configuration and the next open of
  // this dialog has already dropped that person.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/audit-compliance/assignable-users?plantId=${encodeURIComponent(audit.plantId)}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (alive) setSlots(j.assignable ?? null);
      } catch {
        // Fail closed. Falling back to the full directory would re-open the
        // hole the scoped picker exists to close.
        if (alive) {
          setSlots({ leadAuditor: [], coAuditor: [], plantManager: [], auditee: [] });
          setLoadError("Could not load who is authorised for these roles. Reload before saving.");
        }
      }
    })();
    return () => { alive = false; };
  }, [audit.plantId]);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const list of Object.values(slots ?? {})) {
      for (const u of list) m.set(u.id, u.name);
    }
    for (const t of [...(audit.team?.coAuditors ?? []), ...(audit.team?.auditees ?? [])]) {
      if (!m.has(t.userId)) m.set(t.userId, t.name);
    }
    return (id: string) => m.get(id) ?? "Unknown user";
  }, [slots, audit.team]);

  const coIds = coAuditors.map((s) => s.userId);
  const auIds = auditees.map((s) => s.userId);

  // Mirrors the server rule rather than merely decorating it: the same person
  // cannot audit and be audited on one engagement. Shown here so the clash is
  // visible while choosing, and still enforced server-side.
  const clash = useMemo(
    () => [...new Set([...coIds, audit.leadAuditorUserId].filter((i) => auIds.includes(i)))],
    [coIds, auIds, audit.leadAuditorUserId],
  );

  // Disciplines with nobody to answer for them. Not an error — an audit is
  // legitimately scheduled before its auditees are known — but it is the thing
  // this dialog exists to resolve, so it is named.
  const uncovered = useMemo(() => {
    const covered = new Set(auditees.flatMap((s) => s.disciplineIds));
    return disciplines.filter((d) => !covered.has(d.categoryId));
  }, [auditees, disciplines]);

  function addSeat(kind: "co" | "au", userId: string) {
    if (!userId) return;
    const set = kind === "co" ? setCoAuditors : setAuditees;
    set((prev) => (prev.some((s) => s.userId === userId)
      ? prev
      : [...prev, { userId, disciplineIds: [] }]));
  }
  function removeSeat(kind: "co" | "au", userId: string) {
    const set = kind === "co" ? setCoAuditors : setAuditees;
    set((prev) => prev.filter((s) => s.userId !== userId));
  }
  function toggleDiscipline(kind: "co" | "au", userId: string, code: string) {
    const set = kind === "co" ? setCoAuditors : setAuditees;
    set((prev) => prev.map((s) => {
      if (s.userId !== userId) return s;
      const on = s.disciplineIds.includes(code);
      return { ...s, disciplineIds: on ? s.disciplineIds.filter((c) => c !== code) : [...s.disciplineIds, code] };
    }));
  }

  async function save() {
    if (clash.length > 0) {
      toast({
        variant: "error", title: "Segregation of duties",
        description: `${clash.map(nameOf).join(", ")} cannot be both auditor and auditee on this audit.`,
      });
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/audit-compliance/${audit.id}/team`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        coAuditors: coAuditors.map((s) => ({ userId: s.userId, disciplineIds: s.disciplineIds })),
        auditees: auditees.map((s) => ({ userId: s.userId, responsibleCategories: s.disciplineIds })),
        plantManagerUserId: plantManagerUserId || null,
        overrideManualAllocations: overrideManual,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Couldn't update the team", description: apiErrorMessage(j, res.status) });
      return;
    }
    const j = await res.json();
    // Naming the re-routing is the point: seating an auditee that moved no
    // checkpoints usually means their disciplines were never ticked.
    toast({
      variant: "success",
      title: "Audit team updated",
      description: j.checkpointsRerouted
        ? `${j.checkpointsRerouted} checkpoint(s) re-routed to the new owners.`
        : "No checkpoint routing changed.",
    });
    onSaved();
    onClose();
  }

  const loading = slots === null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users2 size={18} className="text-primary-700" /> Audit team
          </DialogTitle>
          <DialogDescription className="sr-only">
            Assign co-auditors and auditees, and the disciplines each covers.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b bg-slate-50 px-5 py-2 text-[12px] leading-relaxed text-slate-600">
          Auditees can be added at any point before the audit closes — including after the
          opening meeting, which is usually when they are identified. Saving re-routes the
          checkpoints in each discipline to the person named for it.
        </div>

        {loadError && (
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-[12px] text-amber-900">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {loadError}
          </div>
        )}

        <div className="max-h-[62vh] space-y-4 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-400">
              <Loader2 size={16} className="mr-2 animate-spin" /> Loading authorised people…
            </div>
          ) : (
            <>
              <SeatGroup
                title="Auditees"
                note="Every checkpoint below Effective in their disciplines routes to them for a response."
                kind="au"
                seats={auditees}
                candidates={slots.auditee}
                disciplines={disciplines}
                nameOf={nameOf}
                clash={clash}
                onAdd={addSeat}
                onRemove={removeSeat}
                onToggle={toggleDiscipline}
              />

              {uncovered.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-900">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>
                    No auditee yet for {uncovered.map((d) => d.categoryName).join(", ")}. Findings
                    there will route to the plant manager until someone is named.
                  </span>
                </div>
              )}

              <SeatGroup
                title="Co-auditors"
                note="Conduct only the disciplines ticked against their name. The lead auditor covers the rest."
                kind="co"
                seats={coAuditors}
                candidates={slots.coAuditor}
                disciplines={disciplines}
                nameOf={nameOf}
                clash={clash}
                onAdd={addSeat}
                onRemove={removeSeat}
                onToggle={toggleDiscipline}
              />

              <div className="rounded-lg border border-slate-200 p-3">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Plant manager (reviewer)
                </Label>
                <p className="mb-2 text-[11px] text-slate-400">
                  Accepts, sends back or escalates auditee responses, and receives findings in
                  disciplines with no named auditee.
                </p>
                <Select value={plantManagerUserId} onChange={(e) => setPM(e.target.value)} className="h-8 text-xs">
                  <option value="">— none —</option>
                  {slots.plantManager.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </div>

              <label className="flex items-start gap-2 text-[12px] text-slate-600">
                <Checkbox
                  checked={overrideManual}
                  onChange={(e) => setOverrideManual(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Also reset checkpoints that were allocated individually.
                  <span className="block text-[11px] text-slate-400">
                    Off by default — a per-checkpoint decision someone made by hand is not
                    undone by a discipline-level default.
                  </span>
                </span>
              </label>

              {clash.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {clash.map(nameOf).join(", ")} {clash.length === 1 ? "is" : "are"} seated as both
                    auditor and auditee. One person cannot audit their own area.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" onClick={save} disabled={busy || loading || clash.length > 0}>
            {busy && <Loader2 size={14} className="animate-spin" />} Save team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SeatGroup({
  title, note, kind, seats, candidates, disciplines, nameOf, clash, onAdd, onRemove, onToggle,
}: {
  title: string; note: string; kind: "co" | "au";
  seats: Seat[]; candidates: Candidate[]; disciplines: DisciplineRollup[];
  nameOf: (id: string) => string; clash: string[];
  onAdd: (k: "co" | "au", id: string) => void;
  onRemove: (k: "co" | "au", id: string) => void;
  onToggle: (k: "co" | "au", id: string, code: string) => void;
}) {
  const seated = new Set(seats.map((s) => s.userId));
  const available = candidates.filter((c) => !seated.has(c.id));

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</Label>
        <span className="text-[11px] text-slate-400">{seats.length} seated</span>
        <Select
          value=""
          className="ml-auto h-8 w-56 text-xs"
          onChange={(e) => { onAdd(kind, e.target.value); e.target.value = ""; }}
          disabled={available.length === 0}
        >
          <option value="">{available.length ? "Add person →" : "No one else authorised"}</option>
          {available.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}{u.department ? ` · ${u.department}` : ""}
            </option>
          ))}
        </Select>
      </div>
      <p className="mb-2 mt-1 text-[11px] text-slate-400">{note}</p>

      {seats.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">
          — none assigned yet —
        </div>
      ) : (
        <ul className="space-y-2">
          {seats.map((s) => (
            <li
              key={s.userId}
              className={cn(
                "rounded-md border bg-white px-2.5 py-2",
                clash.includes(s.userId) ? "border-rose-300 bg-rose-50/50" : "border-slate-200",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{nameOf(s.userId)}</span>
                {s.disciplineIds.length === 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    no disciplines
                  </span>
                )}
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => onRemove(kind, s.userId)}
                  className="ml-auto size-6 text-slate-400 hover:text-rose-600"
                  aria-label={`Remove ${nameOf(s.userId)}`}
                >
                  <X size={13} />
                </Button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {disciplines.map((d) => {
                  const on = s.disciplineIds.includes(d.categoryId);
                  return (
                    <Button
                      key={d.categoryId} type="button" variant="ghost"
                      onClick={() => onToggle(kind, s.userId, d.categoryId)}
                      aria-pressed={on}
                      className={cn(
                        "h-auto rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                        on ? "border-primary-500 bg-primary-50 text-primary-800" : "border-slate-200 text-slate-400",
                      )}
                    >
                      {on && <Plus size={10} className="rotate-45" />} {d.categoryName}
                    </Button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
