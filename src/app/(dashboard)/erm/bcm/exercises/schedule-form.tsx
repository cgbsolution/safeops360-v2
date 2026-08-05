"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { EXERCISE_TYPES } from "@/app/(dashboard)/erm/lib-p3";

type PlanOption = { id: string; planCode: string; title: string };

const TYPE_LABEL: Record<string, string> = {
  DESK_CHECK: "Desk Check",
  TABLETOP: "Tabletop",
  SIMULATION: "Simulation",
  FULL_INTERRUPTION_TEST: "Full Interruption",
  CALL_TREE_TEST: "Call-Tree Test",
};

export function ScheduleExerciseButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> Schedule Exercise
      </Button>
      {open && <ScheduleModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />}
    </>
  );
}

function ScheduleModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [exerciseType, setExerciseType] = useState<string>("TABLETOP");
  const [scheduledDate, setScheduledDate] = useState("");
  const [facilitatorId, setFacilitatorId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [testedPlanIds, setTestedPlanIds] = useState<string[]>([]);
  const [objectivesText, setObjectivesText] = useState("");
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/erm/bcm/plans")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        const items: PlanOption[] = (data?.items ?? data ?? []).map((p: any) => ({
          id: p.id,
          planCode: p.planCode,
          title: p.title,
        }));
        setPlans(items);
      })
      .catch((e: Error) => {
        if (!cancelled) setPlansError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function togglePlan(id: string) {
    setTestedPlanIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const objectives = objectivesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/erm/bcm/exercises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          exerciseType,
          scheduledDate,
          testedPlanIds,
          facilitatorId,
          participants,
          objectives,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to schedule exercise (${res.status}).`);
        setBusy(false);
        return;
      }
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "Network error scheduling exercise.");
      setBusy(false);
    }
  }

  const valid = title.trim() && scheduledDate && facilitatorId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Schedule Exercise</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 IT DR failover tabletop"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Exercise type</label>
              <Select value={exerciseType} onChange={(e) => setExerciseType(e.target.value)}>
                {EXERCISE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t] ?? t.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Scheduled date</label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Facilitator</label>
            <UserPicker
              value={facilitatorId}
              onChange={(id) => setFacilitatorId(id)}
              placeholder="Select facilitator"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Participants</label>
            <UserPicker
              multiple
              value={participants}
              onChange={(ids) => setParticipants(ids)}
              placeholder="Select participants"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Plans under test</label>
            {plansError ? (
              <p className="text-xs text-rose-600">Failed to load plans: {plansError}</p>
            ) : plans.length === 0 ? (
              <p className="text-xs text-slate-400">No plans available.</p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {plans.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
                    <Checkbox checked={testedPlanIds.includes(p.id)} onChange={() => togglePlan(p.id)} />
                    <span className="font-medium text-primary-700">{p.planCode}</span>
                    <span className="truncate text-slate-600">{p.title}</span>
                  </label>
                ))}
              </div>
            )}
            {testedPlanIds.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-400">{testedPlanIds.length} plan(s) selected</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Objectives (one per line)</label>
            <Textarea
              value={objectivesText}
              onChange={(e) => setObjectivesText(e.target.value)}
              rows={3}
              placeholder={"Validate RTO for order-to-cash\nConfirm call-tree reachability"}
            />
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy || !valid}>
            {busy ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
