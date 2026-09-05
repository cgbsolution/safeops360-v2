"use client";

// Slot management — create a planned engagement, and move it (docs/cams/08 §3).
//
// **A slot is not an engagement.** The form captures a WINDOW, not a date: a
// programme that commits to 2027-06-14 twelve months out is lying, and the
// variance report needs a window to measure drift against.
//
// The rule this UI exists to make visible:
//
//     no slot leaves PLANNED without either a materialised engagement
//     or an amendment explaining why it did not happen
//
// DEFER / CANCEL / WAIVE force a reason and a named approver, and the other
// half of that rule — actually producing the engagement — is `Materialise`,
// which lives on the slot's own route because a slot carries more than a
// dialog can hold honestly. Row → `/slots/[slotId]`.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, ArrowRightLeft, CalendarRange, Link2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";
import { SlotTransitionDialog } from "@/components/programme/slot-transition-dialog";
import { SelectField } from "@/components/ui/select-field";
import { Alert } from "@/components/ui/alert";
import {
  ORIGIN_LABEL,
  SLOT_STATUS_CHIP,
  fmtDate,
  siteText,
  type ProgrammeCycleRow,
  type ScopeUnitRow,
  type SlotRow,
} from "@/app/(dashboard)/cams/programme/lib-programme";

const SAMPLING = [
  { value: "FULL", label: "Full — every checkpoint assessed" },
  { value: "RANDOM_N_OF_M", label: "Random n-of-m" },
  { value: "RISK_WEIGHTED", label: "Risk-weighted" },
  { value: "JUDGEMENTAL", label: "Judgemental" },
];

export function SlotManager({
  cycle,
  programmeId,
  slots,
  scopeUnits,
  canManage,
}: {
  cycle: ProgrammeCycleRow;
  programmeId: string;
  slots: SlotRow[];
  scopeUnits: ScopeUnitRow[];
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [transitioning, setTransitioning] = useState<SlotRow | null>(null);

  const unitById = new Map(scopeUnits.map((u) => [u.id, u]));
  const slotHref = (s: SlotRow) => `/cams/programme/${programmeId}/slots/${s.id}`;

  return (
    <div className="space-y-3">
      <Card className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Planned engagements</h3>
            <p className="mt-1 max-w-prose text-xs text-slate-500">
              A slot holds the plan — a <strong>window</strong>, a scope, an intended lead and an
              estimate. It becomes an engagement when one is materialised against it. A slot that
              never runs needs an amendment saying why.
            </p>
          </div>
          {canManage && (
            <Button type="button" size="sm" onClick={() => setCreating(true)} disabled={!scopeUnits.length}>
              <Plus size={14} /> Add slot
            </Button>
          )}
        </div>
        {!scopeUnits.length && (
          <p className="mt-2 text-xs text-amber-700">
            This cycle has no scope units yet — a slot has to cover something, so add scope units
            first.
          </p>
        )}
      </Card>

      {slots.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          No slots planned in this cycle yet.
        </Card>
      ) : (
        <div className="space-y-2">
          {slots.map((s) => (
            <Card key={s.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={slotHref(s)} className="text-sm font-medium text-violet-800 hover:underline">
                  {s.slotCode}
                </Link>
                <span className={cn("rounded border px-1.5 py-0.5 text-[11px]", SLOT_STATUS_CHIP[s.status] ?? "")}>
                  {s.status.replace(/_/g, " ").toLowerCase()}
                </span>
                {s.origin !== "INTERNAL" && (
                  <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {ORIGIN_LABEL[s.origin]}
                    {s.externalBody ? ` · ${s.externalBody}` : ""}
                  </span>
                )}
                {s.engagementId && (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-800">
                    <Link2 size={10} /> materialised
                  </span>
                )}
                {s.amendmentCount > 0 && (
                  <span className="text-[10px] text-amber-700">
                    {s.amendmentCount} amendment{s.amendmentCount === 1 ? "" : "s"}
                  </span>
                )}
                <div className="ml-auto flex gap-1.5">
                  {canManage && !s.engagementId && s.allowedTransitions.includes("SCHEDULED") && (
                    // The real materialise flow lives on the slot route, where
                    // the plan it pre-fills from is visible.
                    <Button asChild size="sm" className="h-7 text-[11px]">
                      <Link href={slotHref(s)}><Zap size={12} /> Materialise</Link>
                    </Button>
                  )}
                  {canManage && s.allowedTransitions.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => setTransitioning(s)}
                    >
                      <ArrowRightLeft size={12} /> Move
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <CalendarRange size={12} className="text-slate-400" />
                  {fmtDate(s.windowStart)} – {fmtDate(s.windowEnd)}
                </span>
                <span className="text-slate-400">P{s.periodIndex + 1}</span>
                <span>{s.estimatedAuditorDays}d est.</span>
                {s.samplingApproach !== "FULL" && (
                  <span className="rounded border border-teal-200 bg-teal-50 px-1.5 text-[10px] text-teal-800">
                    {s.samplingApproach.replace(/_/g, " ").toLowerCase()}
                  </span>
                )}
              </div>

              {s.scopeUnitIds.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s.scopeUnitIds.map((id) => (
                    <span
                      key={id}
                      className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-800"
                    >
                      {unitById.get(id)?.dimensionLabel ?? id.slice(0, 8)}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <CreateSlotDialog
          cycle={cycle}
          scopeUnits={scopeUnits}
          onClose={() => setCreating(false)}
        />
      )}
      {transitioning && (
        <SlotTransitionDialog slot={transitioning} onClose={() => setTransitioning(null)} />
      )}
    </div>
  );
}

function CreateSlotDialog({
  cycle, scopeUnits, onClose,
}: {
  cycle: ProgrammeCycleRow;
  scopeUnits: ScopeUnitRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [slotCode, setSlotCode] = useState("");
  const [windowStart, setWindowStart] = useState(cycle.periodStart.slice(0, 10));
  const [windowEnd, setWindowEnd] = useState(cycle.periodEnd.slice(0, 10));
  const [periodIndex, setPeriodIndex] = useState(0);
  const [origin, setOrigin] = useState("INTERNAL");
  const [externalBody, setExternalBody] = useState("");
  const [lead, setLead] = useState("");
  const [days, setDays] = useState("1");
  const [sampling, setSampling] = useState("FULL");
  const [justification, setJustification] = useState("");
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const samplingNeedsJustification = sampling !== "FULL" && justification.trim().length === 0;
  const windowInvalid = new Date(windowEnd) < new Date(windowStart);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/programme/slots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cycleId: cycle.id,
        slotCode: slotCode.trim(),
        windowStart,
        windowEnd,
        periodIndex,
        origin,
        externalBody: origin === "EXTERNAL" ? externalBody.trim() || null : null,
        // An external slot has no internal lead but DOES consume auditee-side
        // capacity, which is why its estimate is still captured.
        intendedLeadUserId: origin === "EXTERNAL" ? null : lead || null,
        estimatedAuditorDays: Number(days) || 1,
        samplingApproach: sampling,
        samplingJustification: sampling === "FULL" ? null : justification.trim(),
        scopeUnitIds: unitIds,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not create the slot"));
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Shell title="Add a planned engagement" onClose={onClose}>
      <p className="text-xs text-slate-500">
        Capture a <strong>window</strong>, not a date. The gap between this plan and what actually
        happens is what the variance report measures.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="slot-code" className="text-xs">
            Slot code <span className="text-rose-600">*</span>
          </Label>
          <Input
            id="slot-code"
            value={slotCode}
            onChange={(e) => setSlotCode(e.target.value)}
            placeholder="e.g. S001"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="win-start" className="text-xs">Window opens</Label>
            <Input id="win-start" type="date" value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="win-end" className="text-xs">Window closes</Label>
            <Input id="win-end" type="date" value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)} className="mt-1" />
          </div>
        </div>
        {windowInvalid && (
          <p className="text-[11px] text-rose-600">The window must close on or after it opens.</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="period" className="text-xs">Period</Label>
            <SelectField
              id="period"
              value={String(periodIndex)}
              onChange={(value) => setPeriodIndex(Number(value))}
              className="mt-1"
              options={Array.from({ length: cycle.periodsPerCycle }, (_, i) => ({
                value: String(i),
                label: `P${i + 1}`
              }))}
            />
          </div>
          <div>
            <Label htmlFor="days" className="text-xs">Estimated auditor-days</Label>
            <Input id="days" type="number" min={0.5} step={0.5} value={days}
              onChange={(e) => setDays(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="origin" className="text-xs">Origin</Label>
          <SelectField id="origin" value={origin} onChange={setOrigin} className="mt-1"
            options={[
            { value: "INTERNAL", label: "Internal — our own planned audit" },
            { value: "EXTERNAL", label: "External body — brand, SMETA, certification surveillance" }
          ]}
          />
          {origin === "EXTERNAL" && (
            <>
              <Input value={externalBody} onChange={(e) => setExternalBody(e.target.value)}
                placeholder="Which body? e.g. Sedex, BV, buyer name" className="mt-2 h-8 text-xs" />
              <p className="mt-1 text-[11px] text-slate-500">
                External audits still consume site capacity, so they count in coverage and in the
                load view — they just have no internal lead.
              </p>
            </>
          )}
        </div>

        {origin !== "EXTERNAL" && (
          <div>
            <Label className="text-xs">Intended lead auditor</Label>
            <div className="mt-1">
              <UserPicker value={lead || null} onChange={(id) => setLead(id ?? "")}
                placeholder="Optional at planning time…" />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="sampling" className="text-xs">Sampling approach</Label>
          <SelectField id="sampling" value={sampling} onChange={setSampling} className="mt-1"
            options={SAMPLING.map((s) => ({ value: s.value, label: s.label }))}
          />
          {sampling !== "FULL" && (
            <>
              <Textarea rows={2} value={justification} onChange={(e) => setJustification(e.target.value)}
                placeholder="Why this sampling basis, and what population it draws from…"
                className="mt-2 text-xs" />
              <p className="mt-1 text-[11px] text-slate-500">
                Required. The auditable artefact is the justification, and coverage will show this
                as &ldquo;covered by sample&rdquo; — a weaker claim than full verification.
              </p>
            </>
          )}
        </div>

        <div>
          <Label className="text-xs">
            Scope units covered <span className="text-rose-600">*</span>
          </Label>
          <Card className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 shadow-none">
            {scopeUnits.map((u) => {
              const on = unitIds.includes(u.id);
              return (
                <Button variant="ghost"
                  key={u.id}
                  type="button"
                  onClick={() =>
                    setUnitIds((p) => (on ? p.filter((x) => x !== u.id) : [...p, u.id]))
                  }
                  className={cn(
                    "justify-start flex w-full items-center gap-2 border-b border-slate-100 px-2.5 py-1.5 text-left text-xs last:border-0 hover:bg-slate-50",
                    on && "bg-violet-50/60",
                  )}>
                  <span className={cn("flex size-3.5 items-center justify-center rounded border text-[9px]",
                    on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300")}>
                    {on && "✓"}
                  </span>
                  <span className="truncate text-slate-700">{u.dimensionLabel}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                    {siteText(u, { short: true })}
                  </span>
                </Button>
              );
            })}
          </Card>
          {unitIds.length === 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              A slot must cover at least one scope unit, or it contributes nothing to coverage.
            </p>
          )}
        </div>
      </div>

      {err && (
        <Alert variant="destructive" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </Alert>
      )}

      <Footer
        onClose={onClose}
        busy={busy}
        disabled={busy || !slotCode.trim() || !unitIds.length || windowInvalid || samplingNeedsJustification}
        onSubmit={submit}
        label="Create slot"
      />
    </Shell>
  );
}

function Shell({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Footer({
  onClose, busy, disabled, onSubmit, label,
}: {
  onClose: () => void; busy: boolean; disabled: boolean;
  onSubmit: () => void; label: string;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
        Cancel
      </Button>
      <Button type="button" size="sm" onClick={onSubmit} disabled={disabled}>
        {busy && <Loader2 size={14} className="animate-spin" />} {label}
      </Button>
    </div>
  );
}
